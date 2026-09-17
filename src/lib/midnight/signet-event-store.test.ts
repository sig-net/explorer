import type { IndexedSignetMiscEvent } from '@sig-net/midnight'
import { expect, test, vi } from 'vitest'

import {
  type IndexedSignetEventSource,
  type SignetContractLocation,
  type SignetEventLoad,
  SignetEventStore,
} from './signet-event-store'

const LOCATION: SignetContractLocation = {
  indexerUrl: 'https://indexer.example/api/v4/graphql',
  signetContractAddress: '380b1348271af7dc5a18e199aa90483830342f16267025699b940ee4bfd35193',
}
const OTHER_LOCATION: SignetContractLocation = {
  ...LOCATION,
  signetContractAddress: 'ab0b1348271af7dc5a18e199aa90483830342f16267025699b940ee4bfd35193',
}
const TIP_ID = 500

function signetEvent(id: number): IndexedSignetMiscEvent {
  return {
    name: 'SomethingElse',
    payload: new Uint8Array(256),
    id,
    maxId: TIP_ID,
    transactionId: id,
    transactionHash: 'e5'.repeat(32),
    blockHeight: 1000 + id,
    blockHash: 'c0'.repeat(32),
    blockTimestamp: new Date(1788932760000 + id),
  }
}

function eventsFrom(first: number, count: number): IndexedSignetMiscEvent[] {
  return Array.from({ length: count }, (_, index) => signetEvent(first + index))
}

interface HeldPage {
  resolve: (events: IndexedSignetMiscEvent[]) => void
  reject: (error: Error) => void
}

/**
 * An event source whose stream waits for the test to release each page. A released empty page
 * ends the stream.
 */
function heldSource(): {
  source: IndexedSignetEventSource
  pages: HeldPage[]
  streams: string[]
} {
  const pages: HeldPage[] = []
  const streams: string[] = []
  const source: IndexedSignetEventSource = {
    async *streamSignetEvents(contractAddress) {
      streams.push(contractAddress)
      for (;;) {
        const page = await new Promise<IndexedSignetMiscEvent[]>((resolve, reject) => {
          pages.push({ resolve, reject })
        })
        if (page.length === 0) {
          return
        }
        yield* page
      }
    },
  }
  return { source, pages, streams }
}

/** An event source streaming `count` events straight away. */
function servingSource(count: number): { source: IndexedSignetEventSource; streams: string[] } {
  const streams: string[] = []
  const source: IndexedSignetEventSource = {
    async *streamSignetEvents(contractAddress) {
      streams.push(contractAddress)
      yield* eventsFrom(1, count)
    },
  }
  return { source, streams }
}

function loadOf(store: SignetEventStore): SignetEventLoad {
  const snapshot = store.getSnapshot()
  if (snapshot.status === 'unconfigured') {
    throw new Error('store has no current location')
  }
  return snapshot
}

async function waitForStatus(store: SignetEventStore, status: SignetEventLoad['status']) {
  await vi.waitFor(() => {
    expect(store.getSnapshot().status).toBe(status)
  })
}

test('a location loads page by page and completes when the stream ends', async () => {
  const held = heldSource()
  const store = new SignetEventStore()
  const listener = vi.fn<() => void>()
  store.subscribe(listener)

  expect(store.getSnapshot()).toEqual({ status: 'unconfigured' })
  store.select(LOCATION, held.source)
  expect(loadOf(store)).toMatchObject({
    status: 'loading',
    location: LOCATION,
    events: [],
    lifecycles: [],
  })
  await vi.waitFor(() => {
    expect(held.pages).toHaveLength(1)
  })
  expect(held.streams).toEqual([LOCATION.signetContractAddress])

  held.pages[0]?.resolve(eventsFrom(1, 100))
  await vi.waitFor(() => {
    expect(loadOf(store).events).toHaveLength(100)
  })
  expect(loadOf(store)).toMatchObject({ status: 'loading', lastId: 100, tipId: TIP_ID })
  await vi.waitFor(() => {
    expect(held.pages).toHaveLength(2)
  })

  held.pages[1]?.resolve(eventsFrom(101, 30))
  await vi.waitFor(() => {
    expect(held.pages).toHaveLength(3)
  })
  held.pages[2]?.resolve([])
  await waitForStatus(store, 'loaded')
  expect(loadOf(store)).toMatchObject({ lastId: 130, tipId: TIP_ID, error: null })
  expect(loadOf(store).events).toHaveLength(130)
  expect(loadOf(store).events[0]).toMatchObject({
    kind: 'unrecognised',
    source: { id: 1, transactionId: 1 },
  })
  // select, page one, page two, completion
  expect(listener).toHaveBeenCalledTimes(4)
})

test('a loaded location is reused across re-selection and other locations', async () => {
  const first = servingSource(3)
  const second = servingSource(2)
  const store = new SignetEventStore()

  store.select(LOCATION, first.source)
  await waitForStatus(store, 'loaded')
  const loaded = store.getSnapshot()

  store.select(LOCATION, first.source)
  expect(store.getSnapshot()).toBe(loaded)

  store.select(OTHER_LOCATION, second.source)
  await waitForStatus(store, 'loaded')
  expect(loadOf(store).events).toHaveLength(2)

  store.select(LOCATION, first.source)
  expect(store.getSnapshot()).toBe(loaded)
  expect(first.streams).toHaveLength(1)
  expect(second.streams).toHaveLength(1)
})

test('refresh re-runs the backfill from an empty loading state', async () => {
  const { source, streams } = servingSource(3)
  const store = new SignetEventStore()
  store.select(LOCATION, source)
  await waitForStatus(store, 'loaded')

  store.refresh()
  expect(loadOf(store)).toMatchObject({ status: 'loading', events: [] })
  await waitForStatus(store, 'loaded')
  expect(loadOf(store).events).toHaveLength(3)
  expect(streams).toHaveLength(2)
})

test('a load that stops matching the current location is abandoned', async () => {
  const held = heldSource()
  const other = servingSource(1)
  const store = new SignetEventStore()

  store.select(LOCATION, held.source)
  await vi.waitFor(() => {
    expect(held.pages).toHaveLength(1)
  })

  store.select(OTHER_LOCATION, other.source)
  await waitForStatus(store, 'loaded')

  held.pages[0]?.resolve(eventsFrom(1, 100))
  await new Promise((resolve) => setTimeout(resolve, 10))
  expect(held.pages).toHaveLength(1)
  expect(loadOf(store).location).toEqual(OTHER_LOCATION)

  store.select(LOCATION, held.source)
  expect(loadOf(store)).toMatchObject({ status: 'loading', location: LOCATION, events: [] })
  await vi.waitFor(() => {
    expect(held.streams).toHaveLength(2)
  })
})

test('a loading location restarts through a replacement event source', async () => {
  const first = heldSource()
  const second = heldSource()
  const store = new SignetEventStore()

  store.select(LOCATION, first.source)
  store.select(LOCATION, first.source)
  await vi.waitFor(() => {
    expect(first.streams).toHaveLength(1)
  })

  store.select(LOCATION, second.source)
  await vi.waitFor(() => {
    expect(second.streams).toHaveLength(1)
  })
  expect(loadOf(store)).toMatchObject({ status: 'loading', events: [] })
})

test('a stream that fails, before or after yielding, yields an error state', async () => {
  const failingLate: IndexedSignetEventSource = {
    async *streamSignetEvents() {
      yield* eventsFrom(1, 2)
      await Promise.reject(new Error('indexer unreachable'))
    },
  }
  const failingEarly: IndexedSignetEventSource = {
    streamSignetEvents() {
      throw new TypeError('invalid contract address')
    },
  }
  const store = new SignetEventStore()

  store.select(LOCATION, failingLate)
  await waitForStatus(store, 'error')
  expect(loadOf(store)).toMatchObject({ error: 'indexer unreachable', lastId: 2 })
  expect(loadOf(store).events).toHaveLength(2)

  store.select(OTHER_LOCATION, failingEarly)
  await waitForStatus(store, 'error')
  expect(loadOf(store)).toMatchObject({ error: 'invalid contract address', events: [] })
})

test('deselect returns to unconfigured and drops an unfinished load', async () => {
  const held = heldSource()
  const store = new SignetEventStore()
  const listener = vi.fn<() => void>()
  store.subscribe(listener)

  store.select(LOCATION, held.source)
  store.deselect()
  expect(store.getSnapshot()).toEqual({ status: 'unconfigured' })
  expect(listener).toHaveBeenCalledTimes(2)

  store.select(LOCATION, held.source)
  await vi.waitFor(() => {
    expect(held.streams).toHaveLength(2)
  })
})

test('each published snapshot carries the lifecycles of its events', async () => {
  const requestId = new Uint8Array(32).fill(0xaa)
  const payload = new Uint8Array(256)
  payload.set([...requestId, ...new Uint8Array(96).fill(0x33), 1])
  const source: IndexedSignetEventSource = {
    async *streamSignetEvents() {
      yield* eventsFrom(1, 1)
      yield { ...signetEvent(2), name: 'SignatureRespondedEvent', payload }
    },
  }
  const store = new SignetEventStore()
  store.select(LOCATION, source)
  await waitForStatus(store, 'loaded')

  expect(loadOf(store).events).toHaveLength(2)
  expect(loadOf(store).lifecycles).toHaveLength(1)
  expect(loadOf(store).lifecycles[0]?.signatureRespondedEvents[0]?.source.id).toBe(2)
})
