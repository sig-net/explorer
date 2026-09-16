import { expect, test, vi } from 'vitest'

import { type MidnightIndexerServices, MidnightIndexerServicesStore } from './indexer-services'

function connectedServices(store: MidnightIndexerServicesStore): MidnightIndexerServices {
  const services = store.getSnapshot()
  if (services === null) {
    throw new Error('store has no services')
  }
  return services
}

const INDEXER_URLS = {
  indexerUrl: 'https://indexer.example/api/v4/graphql',
  indexerWsUrl: 'wss://indexer.example/api/v4/graphql/ws',
}

test('services rebuild only when an indexer URL changes', () => {
  const store = new MidnightIndexerServicesStore()
  const listener = vi.fn<() => void>()
  store.subscribe(listener)

  store.connect(INDEXER_URLS)
  const first = connectedServices(store)
  const disposeFirst = vi.spyOn(first.publicDataProvider, 'dispose')

  store.connect({ ...INDEXER_URLS })
  expect(store.getSnapshot()).toBe(first)
  expect(listener).toHaveBeenCalledTimes(1)
  expect(disposeFirst).not.toHaveBeenCalled()

  store.connect({ ...INDEXER_URLS, indexerWsUrl: 'wss://other.example/graphql/ws' })
  expect(connectedServices(store)).not.toBe(first)
  expect(listener).toHaveBeenCalledTimes(2)
  expect(disposeFirst).toHaveBeenCalledTimes(1)
})

test('disconnect disposes the services and clears the snapshot', () => {
  const store = new MidnightIndexerServicesStore()
  store.connect(INDEXER_URLS)
  const dispose = vi.spyOn(connectedServices(store).publicDataProvider, 'dispose')

  store.disconnect()
  expect(store.getSnapshot()).toBeNull()
  expect(dispose).toHaveBeenCalledTimes(1)
})
