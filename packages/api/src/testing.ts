import {
  aggregateSignBidirectionalLifecycles,
  decodeSignetContractEvent,
  type SignetContractEvent,
} from '@sig-net/explorer-lib'
import {
  indexedSignetContractEvent,
  LIFECYCLE_FIXTURE_START,
  notificationEvent,
  responseEvent,
} from '@sig-net/explorer-lib/testing'
import { hexToBytes, MidnightNetwork, type RequestIdHex, SignetEventName } from '@sig-net/midnight'

import { PREPROD_REQUEST_CELL_WIRE, PREPROD_REQUEST_ID } from './request-cell.fixture.ts'
import {
  type ContractCallNode,
  ExplorerApiError,
  type ExplorerNetwork,
  type ExplorerService,
  type InspectedSignBidirectionalLifecycle,
  type LifecyclePage,
  type LifecyclesQuery,
} from './service.ts'
import {
  inspectionFromWire,
  resolveLifecyclesQuery,
  type SignBidirectionalInspectionWire,
  withoutQueryString,
} from './wire.ts'

export { PREPROD_REQUEST_CELL_WIRE, PREPROD_REQUEST_ID }

/** An {@link ExplorerService} that answers from `seed`, by the rules the served one follows. */
export function createInMemoryExplorerService(seed: ExplorerSeed): ExplorerService {
  const networks = new Map<MidnightNetwork, InMemoryNetwork>(
    seed.networks.map((network) => [network.network, inMemoryNetwork(network)]),
  )
  const served = (network: MidnightNetwork): InMemoryNetwork => {
    const found = networks.get(network)
    if (found === undefined) {
      throw new ExplorerApiError('unknown_network', `the explorer does not serve ${network}`)
    }
    return found
  }
  return {
    networks(): Promise<ExplorerNetwork[]> {
      return Promise.resolve(
        seed.networks.map(({ network, config, sync }) => ({
          network,
          config: { ...config, sourceUrl: withoutQueryString(config.sourceUrl) },
          sync,
        })),
      )
    },
    async lifecycles(network: MidnightNetwork, query?: LifecyclesQuery): Promise<LifecyclePage> {
      const { lifecycles, totalEvents } = served(network)
      const { fragment, excludeCallers, before, limit } = resolveLifecyclesQuery(query)
      const matching = lifecycles.filter((lifecycle) => {
        const callers = lifecycle.signBidirectionalEvents.map((event) => event.record.callerAddress)
        return (
          (lifecycle.requestId.includes(fragment) ||
            callers.some((caller) => caller.includes(fragment))) &&
          !callers.some((caller) => excludeCallers.includes(caller))
        )
      })
      const older =
        before === null ? matching : matching.filter((lifecycle) => lifecycle.firstEventId < before)
      const page = older.slice(0, limit)
      return {
        lifecycles: page,
        nextBefore: older.length > page.length ? (page.at(-1)?.firstEventId ?? null) : null,
        matchingRequests: matching.length,
        matchingEvents: matching.reduce(
          (count, lifecycle) =>
            count +
            lifecycle.signBidirectionalEvents.length +
            lifecycle.signatureRespondedEvents.length +
            lifecycle.respondBidirectionalEvents.length,
          0,
        ),
        totalRequests: lifecycles.length,
        totalEvents,
      }
    },
    async lifecycle(
      network: MidnightNetwork,
      requestId: RequestIdHex,
    ): Promise<InspectedSignBidirectionalLifecycle | null> {
      const { lifecycles } = served(network)
      return lifecycles.find((lifecycle) => lifecycle.requestId === requestId) ?? null
    },
    async callers(network: MidnightNetwork): Promise<string[]> {
      const { lifecycles } = served(network)
      const callers = lifecycles.flatMap((lifecycle) =>
        lifecycle.signBidirectionalEvents.map((event) => event.record.callerAddress),
      )
      return [...new Set(callers)].sort()
    },
  }
}

export interface ExplorerSeed {
  readonly networks: readonly ExplorerSeedNetwork[]
}

export interface ExplorerSeedNetwork extends ExplorerNetwork {
  /** Every event either contract emitted, of any kind. */
  readonly events: readonly SignetContractEvent[]
  /**
   * The inspection of each notification's transaction, by event id. A notification with no entry
   * is served as failed with the reason `not inspected`.
   */
  readonly inspections: ReadonlyMap<number, SignBidirectionalInspectionWire>
}

interface InMemoryNetwork {
  /** Newest first. */
  readonly lifecycles: readonly InspectedSignBidirectionalLifecycle[]
  readonly totalEvents: number
}

function inMemoryNetwork(seed: ExplorerSeedNetwork): InMemoryNetwork {
  const events = seed.events
    .map(({ source, roles }) =>
      decodeSignetContractEvent(
        {
          id: source.id,
          name: source.name,
          payload: source.payload,
          transactionHash: source.transactionHash,
          blockHeight: source.blockHeight,
          blockHash: source.blockHash,
          blockTimestamp: source.blockTimestamp,
        },
        roles,
      ),
    )
    .sort((a, b) => a.source.id - b.source.id)
  const lifecycles = aggregateSignBidirectionalLifecycles(events).map((lifecycle) => ({
    ...lifecycle,
    firstEventId: Math.min(
      ...[
        lifecycle.signBidirectionalEvents[0],
        lifecycle.signatureRespondedEvents[0],
        lifecycle.respondBidirectionalEvents[0],
      ].flatMap((event) => (event === undefined ? [] : [event.source.id])),
    ),
    signBidirectionalEvents: lifecycle.signBidirectionalEvents.map((event) => ({
      ...event,
      inspection: inspectionFromWire(
        seed.inspections.get(event.source.id) ?? { failed: 'not inspected' },
      ),
    })),
  }))
  return { lifecycles, totalEvents: events.length }
}

/** The request ids and callers of {@link explorerSeed}, by the case each stands for. */
export const EXPLORER_SEED_CASES = {
  /** Notified once, signed and attested: its inspection holds {@link PREPROD_REQUEST_CELL_WIRE}. */
  completeRequestId: PREPROD_REQUEST_ID,
  completeCaller: '4890aeb5fb2eaee7dafe6c87ca73d34807ce61b92d4542c1c82e2296e5e2a728',
  /** A signature for a request no event notified: the lifecycle names no caller. */
  responseWithoutRequestId: 'b1'.repeat(32),
  /**
   * Notified by two callers. The first transaction wrote no request, and the cell of the second
   * does not decode.
   */
  notifiedTwiceRequestId: 'c2'.repeat(32),
  notifiedTwiceCallers: ['c0'.repeat(32), 'c1'.repeat(32)],
  /** Notified in a transaction the explorer could not inspect. */
  failedInspectionRequestId: 'd3'.repeat(32),
  failedInspectionCaller: 'd0'.repeat(32),
  /** An attestation for a request no event notified: the lifecycle names no caller. */
  attestationWithoutRequestId: 'e4'.repeat(32),
  /** Notified in a transaction that was never inspected. */
  notInspectedRequestId: 'f5'.repeat(32),
} as const

const SEED_SIGNER_ADDRESS = '51'.repeat(32)
const SEED_RESPONDER_ADDRESS = '52'.repeat(32)

function seedCallChains(caller: string): ContractCallNode[] {
  return [
    {
      entryPoint: 'requestSignature',
      address: caller,
      fallible: false,
      calls: [
        {
          entryPoint: 'notifySignBidirectional',
          address: SEED_SIGNER_ADDRESS,
          fallible: false,
          calls: [],
        },
      ],
    },
  ]
}

/**
 * Two networks: preprod, synced, with twelve events that cover every case of
 * {@link EXPLORER_SEED_CASES} beside an event of another name and one that does not decode, and
 * preview, which has read nothing yet.
 */
export const explorerSeed: ExplorerSeed = {
  networks: [
    {
      network: MidnightNetwork.Preprod,
      config: {
        signerContractAddress: SEED_SIGNER_ADDRESS,
        responderContractAddress: SEED_RESPONDER_ADDRESS,
        startBlock: 1000,
        sourceUrl: 'https://indexer.preprod.example/api/v4/graphql?project_id=seed-token',
      },
      sync: {
        state: 'synced',
        processedBlock: 1012,
        processedBlockTime: new Date(LIFECYCLE_FIXTURE_START.getTime() + 12_000),
        tipBlock: 1012,
        lastSuccessAt: new Date(LIFECYCLE_FIXTURE_START.getTime() + 15_000),
        error: null,
      },
      events: [
        indexedSignetContractEvent(1, 'signer', 'SomeOtherEvent', [], 1),
        notificationEvent(
          2,
          hexToBytes(EXPLORER_SEED_CASES.completeRequestId),
          hexToBytes(EXPLORER_SEED_CASES.completeCaller),
          2,
        ),
        responseEvent(
          3,
          SignetEventName.SignatureRespondedEvent,
          hexToBytes(EXPLORER_SEED_CASES.completeRequestId),
          3,
        ),
        responseEvent(
          4,
          SignetEventName.SignatureRespondedEvent,
          hexToBytes(EXPLORER_SEED_CASES.responseWithoutRequestId),
          4,
        ),
        responseEvent(
          5,
          SignetEventName.RespondBidirectionalEvent,
          hexToBytes(EXPLORER_SEED_CASES.completeRequestId),
          5,
        ),
        notificationEvent(
          6,
          hexToBytes(EXPLORER_SEED_CASES.notifiedTwiceRequestId),
          hexToBytes(EXPLORER_SEED_CASES.notifiedTwiceCallers[0]),
          6,
        ),
        notificationEvent(
          7,
          hexToBytes(EXPLORER_SEED_CASES.failedInspectionRequestId),
          hexToBytes(EXPLORER_SEED_CASES.failedInspectionCaller),
          7,
        ),
        notificationEvent(
          8,
          hexToBytes(EXPLORER_SEED_CASES.notifiedTwiceRequestId),
          hexToBytes(EXPLORER_SEED_CASES.notifiedTwiceCallers[1]),
          8,
        ),
        responseEvent(
          9,
          SignetEventName.SignatureRespondedEvent,
          hexToBytes(EXPLORER_SEED_CASES.notifiedTwiceRequestId),
          9,
        ),
        responseEvent(
          10,
          SignetEventName.RespondBidirectionalEvent,
          hexToBytes(EXPLORER_SEED_CASES.attestationWithoutRequestId),
          10,
        ),
        // A notification of version 0, which the decoder refuses.
        indexedSignetContractEvent(11, 'signer', SignetEventName.SignBidirectionalEvent, [0], 11),
        notificationEvent(
          12,
          hexToBytes(EXPLORER_SEED_CASES.notInspectedRequestId),
          hexToBytes(EXPLORER_SEED_CASES.completeCaller),
          12,
        ),
      ],
      inspections: new Map<number, SignBidirectionalInspectionWire>([
        [
          2,
          {
            callChains: seedCallChains(EXPLORER_SEED_CASES.completeCaller),
            requestCell: PREPROD_REQUEST_CELL_WIRE,
          },
        ],
        [
          6,
          {
            callChains: seedCallChains(EXPLORER_SEED_CASES.notifiedTwiceCallers[0]),
            requestCell: null,
          },
        ],
        [7, { failed: 'the indexer serves no transaction of this hash' }],
        [
          8,
          {
            callChains: seedCallChains(EXPLORER_SEED_CASES.notifiedTwiceCallers[1]),
            requestCell: {
              value: PREPROD_REQUEST_CELL_WIRE.value.slice(0, 5),
              alignment: PREPROD_REQUEST_CELL_WIRE.alignment.slice(0, 5),
            },
          },
        ],
      ]),
    },
    {
      network: MidnightNetwork.Preview,
      config: {
        signerContractAddress: SEED_SIGNER_ADDRESS,
        responderContractAddress: SEED_RESPONDER_ADDRESS,
        startBlock: 0,
        sourceUrl: 'https://indexer.preview.example/api/v4/graphql',
      },
      sync: {
        state: 'starting',
        processedBlock: null,
        processedBlockTime: null,
        tipBlock: null,
        lastSuccessAt: null,
        error: null,
      },
      events: [],
      inspections: new Map(),
    },
  ],
}
