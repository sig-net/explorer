const BLOCK_HEIGHT_QUERY = `{ block { height } }`

/** Narrows the indexer's JSON response to the latest block's height. */
function blockHeight(body: unknown): number {
  if (typeof body === 'object' && body !== null && 'data' in body) {
    const { data } = body
    if (typeof data === 'object' && data !== null && 'block' in data) {
      const { block } = data
      if (
        typeof block === 'object' &&
        block !== null &&
        'height' in block &&
        typeof block.height === 'number' &&
        Number.isInteger(block.height) &&
        block.height >= 0
      ) {
        return block.height
      }
    }
  }
  throw new Error('the indexer returned no latest block height')
}

/**
 * The height of the indexer's latest block.
 *
 * @throws {Error} When the indexer cannot be reached, answers a failure status, or answers
 *   without a block.
 */
export async function fetchIndexerBlockHeight(indexerUrl: string): Promise<number> {
  const response = await fetch(indexerUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query: BLOCK_HEIGHT_QUERY }),
  })
  if (!response.ok) {
    throw new Error(`the indexer answered ${String(response.status)}`)
  }
  return blockHeight(await response.json())
}
