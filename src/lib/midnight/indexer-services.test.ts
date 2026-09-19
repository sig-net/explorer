import { expect, test, vi } from 'vitest'

import { type MidnightIndexerServices, MidnightIndexerServicesStore } from './indexer-services'

function connectedServices(store: MidnightIndexerServicesStore): MidnightIndexerServices {
  const services = store.getSnapshot()
  if (services === null) {
    throw new Error('store has no services')
  }
  return services
}

const INDEXER_URLS = { indexerUrl: 'https://indexer.example/api/v4/graphql' }

test('services rebuild only when the indexer URL changes', () => {
  const store = new MidnightIndexerServicesStore()
  const listener = vi.fn<() => void>()
  store.subscribe(listener)

  store.connect(INDEXER_URLS)
  const first = connectedServices(store)

  store.connect({ ...INDEXER_URLS })
  expect(store.getSnapshot()).toBe(first)
  expect(listener).toHaveBeenCalledTimes(1)

  store.connect({ indexerUrl: 'https://other.example/api/v4/graphql' })
  expect(connectedServices(store)).not.toBe(first)
  expect(connectedServices(store).signetEventSource).not.toBe(first.signetEventSource)
  expect(listener).toHaveBeenCalledTimes(2)
})

test('disconnect clears the snapshot', () => {
  const store = new MidnightIndexerServicesStore()
  const listener = vi.fn<() => void>()
  store.connect(INDEXER_URLS)
  store.subscribe(listener)

  store.disconnect()
  expect(store.getSnapshot()).toBeNull()
  expect(listener).toHaveBeenCalledTimes(1)

  store.disconnect()
  expect(listener).toHaveBeenCalledTimes(1)
})
