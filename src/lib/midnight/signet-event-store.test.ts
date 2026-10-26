import type { IndexedSignetMiscEvent, SignetEventStreamOptions } from '@sig-net/midnight'
import { DateTime } from 'luxon'
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
const TIP = 10000
/** A slice is an eighth of a day of blocks. */
const SLICE = 1543
const BLOCK_START = DateTime.fromISO('2026-09-09T05:46:00Z')

function signetEvent(id: number, blockHeight = TIP - 5): IndexedSignetMiscEvent {
  return {
    name: 'SomethingElse',
    payload: new Uint8Array(256),
    id,
    maxId: 500,
    transactionId: id,
    transactionHash: 'e5'.repeat(32),
    blockHeight,
    blockHash: 'c0'.repeat(32),
    blockTimestamp: BLOCK_START.plus({ milliseconds: id }).toJSDate(),
  }
}

function eventsFrom(first: number, count: number, blockHeight = TIP - 5): IndexedSignetMiscEvent[] {
  return Array.from({ length: count }, (_, index) => signetEvent(first + index, blockHeight))
}

/** The block range one stream request named. */
type Requested = [string, SignetEventStreamOptions | undefined]

interface HeldStream {
  resolve: (events: IndexedSignetMiscEvent[]) => void
  reject: (error: Error) => void
}

/**
 * An event source whose every stream waits for the test to release it, as one page holding the
 * whole slice.
 */
function heldSource(): {
  source: IndexedSignetEventSource
  streams: HeldStream[]
  requested: Requested[]
} {
  const streams: HeldStream[] = []
  const requested: Requested[] = []
  const source: IndexedSignetEventSource = {
    async *streamSignetEvents(contractAddress, options) {
      requested.push([contractAddress, options])
      yield* await new Promise<IndexedSignetMiscEvent[]>((resolve, reject) => {
        streams.push({ resolve, reject })
      })
    },
  }
  return { source, streams, requested }
}

/** An event source answering every slice straight away with `perSlice` events, ids by slice. */
function servingSource(perSlice: number): {
  source: IndexedSignetEventSource
  requested: Requested[]
} {
  const requested: Requested[] = []
  const source: IndexedSignetEventSource = {
    async *streamSignetEvents(contractAddress, options) {
      requested.push([contractAddress, options])
      yield* eventsFrom(requested.length * 100, perSlice)
    },
  }
  return { source, requested }
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

async function waitForStreams(held: { streams: HeldStream[] }, count: number) {
  await vi.waitFor(() => {
    expect(held.streams).toHaveLength(count)
  })
}

test('a range is read newest slice first, each published as it lands, oldest events first', async () => {
  const held = heldSource()
  const store = new SignetEventStore()
  const listener = vi.fn<() => void>()
  store.subscribe(listener)

  expect(store.getSnapshot()).toEqual({ status: 'unconfigured' })
  store.select(LOCATION, held.source, TIP - 2 * SLICE - 10, TIP)
  expect(loadOf(store)).toMatchObject({
    status: 'loading',
    location: LOCATION,
    read: { fromBlock: TIP + 1, toBlock: TIP },
    targetFromBlock: TIP - 2 * SLICE - 10,
    events: [],
  })
  await waitForStreams(held, 1)
  expect(held.requested).toEqual([
    [LOCATION.signetContractAddress, { fromBlock: TIP - SLICE + 1, toBlock: TIP }],
  ])

  held.streams[0]?.resolve(eventsFrom(201, 2))
  await waitForStreams(held, 2)
  expect(loadOf(store)).toMatchObject({ status: 'loading', read: { fromBlock: TIP - SLICE + 1 } })
  expect(loadOf(store).events.map((event) => event.source.id)).toEqual([201, 202])
  expect(held.requested[1]).toEqual([
    LOCATION.signetContractAddress,
    { fromBlock: TIP - 2 * SLICE + 1, toBlock: TIP - SLICE },
  ])

  held.streams[1]?.resolve(eventsFrom(101, 3, TIP - SLICE))
  await waitForStreams(held, 3)
  expect(loadOf(store).events.map((event) => event.source.id)).toEqual([101, 102, 103, 201, 202])
  // The last slice is cut at the target.
  expect(held.requested[2]).toEqual([
    LOCATION.signetContractAddress,
    { fromBlock: TIP - 2 * SLICE - 10, toBlock: TIP - 2 * SLICE },
  ])

  held.streams[2]?.resolve([])
  await waitForStatus(store, 'loaded')
  expect(loadOf(store)).toMatchObject({
    read: { fromBlock: TIP - 2 * SLICE - 10, toBlock: TIP },
    error: null,
  })
  // select, three slices, completion
  expect(listener).toHaveBeenCalledTimes(5)
})

test('a loaded range at the same tip is kept, and extended when a lower block is selected', async () => {
  const held = heldSource()
  const store = new SignetEventStore()

  store.select(LOCATION, held.source, TIP - 10, TIP)
  await waitForStreams(held, 1)
  held.streams[0]?.resolve(eventsFrom(201, 1))
  await waitForStatus(store, 'loaded')
  const loaded = store.getSnapshot()

  store.select(LOCATION, held.source, TIP - 5, TIP)
  expect(store.getSnapshot()).toBe(loaded)

  store.select(LOCATION, held.source, TIP - 10 - SLICE, TIP)
  expect(loadOf(store)).toMatchObject({ status: 'loading', targetFromBlock: TIP - 10 - SLICE })
  await waitForStreams(held, 2)
  expect(held.requested[1]).toEqual([
    LOCATION.signetContractAddress,
    { fromBlock: TIP - 10 - SLICE, toBlock: TIP - 11 },
  ])
  held.streams[1]?.resolve(eventsFrom(101, 1, TIP - 11))
  await waitForStatus(store, 'loaded')
  expect(loadOf(store).events.map((event) => event.source.id)).toEqual([101, 201])
  expect(loadOf(store).read).toEqual({ fromBlock: TIP - 10 - SLICE, toBlock: TIP })
})

test('a lower block selected while a load runs extends that load without a second loop', async () => {
  const held = heldSource()
  const store = new SignetEventStore()

  store.select(LOCATION, held.source, TIP - 10, TIP)
  await waitForStreams(held, 1)
  store.select(LOCATION, held.source, TIP - 10 - SLICE, TIP)
  held.streams[0]?.resolve(eventsFrom(201, 1))
  await waitForStreams(held, 2)
  held.streams[1]?.resolve([])
  await waitForStatus(store, 'loaded')
  expect(held.requested).toHaveLength(2)
  expect(loadOf(store).read.fromBlock).toBe(TIP - 10 - SLICE)
})

test('a new tip, event source or location starts afresh, and loaded locations are reused', async () => {
  const first = servingSource(1)
  const second = servingSource(2)
  const store = new SignetEventStore()

  store.select(LOCATION, first.source, TIP - 10, TIP)
  await waitForStatus(store, 'loaded')
  const loaded = store.getSnapshot()
  expect(first.requested).toHaveLength(1)

  store.select(OTHER_LOCATION, second.source, TIP - 10, TIP)
  await waitForStatus(store, 'loaded')
  expect(loadOf(store).events).toHaveLength(2)

  store.select(LOCATION, first.source, TIP - 10, TIP)
  expect(store.getSnapshot()).toBe(loaded)
  expect(first.requested).toHaveLength(1)

  store.select(LOCATION, first.source, TIP - 10, TIP + 5)
  expect(loadOf(store)).toMatchObject({ status: 'loading', events: [], read: { toBlock: TIP + 5 } })
  await waitForStatus(store, 'loaded')
  expect(first.requested).toHaveLength(2)

  store.select(LOCATION, second.source, TIP - 10, TIP + 5)
  await waitForStatus(store, 'loaded')
  expect(second.requested).toHaveLength(2)
})

test('a load that stops matching the current location is abandoned', async () => {
  const held = heldSource()
  const other = servingSource(1)
  const store = new SignetEventStore()

  store.select(LOCATION, held.source, TIP - 10, TIP)
  await waitForStreams(held, 1)

  store.select(OTHER_LOCATION, other.source, TIP - 10, TIP)
  await waitForStatus(store, 'loaded')

  held.streams[0]?.resolve(eventsFrom(1, 100))
  await new Promise((resolve) => setTimeout(resolve, 10))
  expect(held.streams).toHaveLength(1)
  expect(loadOf(store).location).toEqual(OTHER_LOCATION)

  store.select(LOCATION, held.source, TIP - 10, TIP)
  expect(loadOf(store)).toMatchObject({ status: 'loading', location: LOCATION, events: [] })
  await waitForStreams(held, 2)
})

test('a stream that fails, before or after yielding, yields an error state, and a reselect retries', async () => {
  let attempts = 0
  const failingLate: IndexedSignetEventSource = {
    async *streamSignetEvents() {
      attempts += 1
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

  store.select(LOCATION, failingLate, TIP - 10, TIP)
  await waitForStatus(store, 'error')
  expect(loadOf(store)).toMatchObject({ error: 'indexer unreachable', events: [] })

  store.select(LOCATION, failingLate, TIP - 10, TIP)
  await vi.waitFor(() => {
    expect(attempts).toBe(2)
  })

  store.select(OTHER_LOCATION, failingEarly, TIP - 10, TIP)
  await waitForStatus(store, 'error')
  expect(loadOf(store)).toMatchObject({ error: 'invalid contract address', events: [] })
})

test('an event outside the slice it was asked for is an error, as it would be read twice', async () => {
  const source: IndexedSignetEventSource = {
    async *streamSignetEvents() {
      yield signetEvent(1, TIP + 1)
    },
  }
  const store = new SignetEventStore()
  store.select(LOCATION, source, TIP - 10, TIP)
  await waitForStatus(store, 'error')
  expect(loadOf(store).error).toContain(`block ${String(TIP + 1)} outside the slice`)
})

test('deselect returns to unconfigured and drops an unfinished load', async () => {
  const held = heldSource()
  const store = new SignetEventStore()
  const listener = vi.fn<() => void>()
  store.subscribe(listener)

  store.select(LOCATION, held.source, TIP - 10, TIP)
  store.deselect()
  expect(store.getSnapshot()).toEqual({ status: 'unconfigured' })
  expect(listener).toHaveBeenCalledTimes(2)

  store.select(LOCATION, held.source, TIP - 10, TIP)
  await waitForStreams(held, 2)
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
  store.select(LOCATION, source, TIP - 10, TIP)
  await waitForStatus(store, 'loaded')

  expect(loadOf(store).events).toHaveLength(2)
  expect(loadOf(store).lifecycles).toHaveLength(1)
  expect(loadOf(store).lifecycles[0]?.signatureRespondedEvents[0]?.source.id).toBe(2)
})
