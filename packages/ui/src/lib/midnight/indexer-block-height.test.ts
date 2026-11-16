import { afterEach, expect, test, vi } from 'vitest'

import { fetchIndexerBlockHeight } from './indexer-block-height'

const INDEXER_URL = 'https://indexer.example/api/v4/graphql'

function stubIndexer(body: object, status = 200): void {
  vi.stubGlobal('fetch', () => Promise.resolve(Response.json(body, { status })))
}

afterEach(() => {
  vi.unstubAllGlobals()
})

test('the latest block height is read off the indexer', async () => {
  stubIndexer({ data: { block: { height: 973415 } } })
  expect(await fetchIndexerBlockHeight(INDEXER_URL)).toBe(973415)
})

test('a failure status or an answer without a block rejects', async () => {
  stubIndexer({ errors: [{ message: 'down' }] }, 503)
  await expect(fetchIndexerBlockHeight(INDEXER_URL)).rejects.toThrow('answered 503')
  stubIndexer({ data: { block: null } })
  await expect(fetchIndexerBlockHeight(INDEXER_URL)).rejects.toThrow('no latest block')
  stubIndexer({ data: { block: { height: '973415' } } })
  await expect(fetchIndexerBlockHeight(INDEXER_URL)).rejects.toThrow('no latest block')
})
