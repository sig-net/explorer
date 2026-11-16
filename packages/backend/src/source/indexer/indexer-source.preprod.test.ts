import { decodeSignetContractEvent } from '@sig-net/explorer-lib'
import {
  decodeEvmType2SignBidirectionalEvent,
  getResponderContractAddress,
  getSignerContractAddress,
  hexToBytes,
  MidnightNetwork,
  SignetEventName,
} from '@sig-net/midnight'
import { describe, expect, it } from 'vitest'

import { inspectTransactionForStorage } from '../../inspection/sign-bidirectional-transaction-inspection.ts'
import {
  PREPROD_FIRST_RESPONDER_EVENT_ROW,
  PREPROD_FIRST_SIGNER_EVENT_ROW,
} from './indexer-source.fixture.ts'
import { createIndexerSource } from './indexer-source.ts'

const queryUrl = process.env['EXPLORER_TEST_PREPROD_INDEXER_URL']

describe.skipIf(queryUrl === undefined)('createIndexerSource against preprod', () => {
  it('reads preprod', { timeout: 120_000 }, async () => {
    const source = createIndexerSource({
      queryUrl: queryUrl ?? '',
      signerContractAddress: getSignerContractAddress(MidnightNetwork.Preprod),
      responderContractAddress: getResponderContractAddress(MidnightNetwork.Preprod),
    })
    await expect(source.genesisHash()).resolves.toBe(
      'df831b09a8baa92badf47762ce5ac439b7e47e3ed3d39600cfdd44fad552361b',
    )
    const events = await source.eventsIn({ fromBlock: 3389203, toBlock: 3389208 })
    const ids = events.map(({ source: { id } }) => id)
    expect(ids).toContain(PREPROD_FIRST_SIGNER_EVENT_ROW.id)
    expect(ids).toContain(PREPROD_FIRST_RESPONDER_EVENT_ROW.id)

    const first = events.find(({ source: { id } }) => id === PREPROD_FIRST_SIGNER_EVENT_ROW.id)
    if (first === undefined) {
      throw new Error('the first signer event is missing')
    }
    const decoded = decodeSignetContractEvent(first.source, first.roles)
    if (decoded.kind !== 'decoded' || decoded.name !== SignetEventName.SignBidirectionalEvent) {
      throw new Error(`the first signer event decoded as ${decoded.kind}`)
    }
    const inspection = inspectTransactionForStorage(
      await source.rawTransaction(first.source.transactionHash),
      [decoded],
    )
    if ('failed' in inspection) {
      throw new Error(`the inspection failed: ${inspection.failed}`)
    }
    const entry = inspection.requests[String(first.source.id)]
    if (entry === undefined || 'failed' in entry || entry.cell === null) {
      throw new Error(`no request cell was read: ${JSON.stringify(entry)}`)
    }
    const request = decodeEvmType2SignBidirectionalEvent(
      { value: entry.cell.value.map((atom) => hexToBytes(atom)), alignment: entry.cell.alignment },
      'the stored request cell',
    )
    expect(request.txParams.chainId).toBe(11155111n)
  })
})
