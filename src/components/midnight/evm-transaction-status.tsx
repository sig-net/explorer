import { CircleAlert, CircleCheck, CircleHelp, CircleX, RefreshCw } from 'lucide-react'
import { useEffect, useState } from 'react'

import { useMidnight } from '@/components/contexts/MidnightContext'
import { DetailLine, DetailList } from '@/components/detail-list'
import { ExternalLinkButton } from '@/components/external-link-button'
import { InfoTooltip } from '@/components/info-tooltip'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { etherscanBroadcastUrl } from '@/lib/midnight/evm-block-explorer'
import {
  type EvmSubmissionBlocker,
  type EvmTransactionQuery,
  type EvmTransactionStatus as EvmTransactionStatusReport,
  evmRpcUrl,
  fetchEvmTransactionStatus,
} from '@/lib/midnight/evm-transaction-status'
import { formatDuration, formatLocalTimestamp } from '@/lib/format'

type LookupState =
  | { readonly status: 'loading' }
  | {
      readonly status: 'loaded'
      readonly report: EvmTransactionStatusReport
      /** When the node answered, in epoch milliseconds: what the report's ages are measured to. */
      readonly checkedAt: number
    }
  | { readonly status: 'error'; readonly error: string }

/** A settled lookup, tagged with what it was made for. */
interface SettledLookup {
  readonly rpcUrl: string
  readonly hash: string
  readonly attempt: number
  readonly state: LookupState
}

/** One node's report on the transaction, asked again whenever `attempt` changes. */
function useEvmTransactionStatus(
  rpcUrl: string,
  { hash, from, nonce, gasLimit, maxFeePerGas, value }: EvmTransactionQuery,
  attempt: number,
): LookupState {
  const [settled, setSettled] = useState<SettledLookup | null>(null)

  useEffect(() => {
    let current = true
    const settle = (state: LookupState) => {
      if (current) {
        setSettled({ rpcUrl, hash, attempt, state })
      }
    }
    fetchEvmTransactionStatus(rpcUrl, { hash, from, nonce, gasLimit, maxFeePerGas, value }).then(
      (report) => settle({ status: 'loaded', report, checkedAt: Date.now() }),
      (error: unknown) =>
        settle({ status: 'error', error: error instanceof Error ? error.message : String(error) }),
    )
    return () => {
      current = false
    }
  }, [rpcUrl, hash, from, nonce, gasLimit, maxFeePerGas, value, attempt])

  // A result settled for other inputs is stale, so the current inputs are still loading.
  return settled?.rpcUrl === rpcUrl && settled.hash === hash && settled.attempt === attempt
    ? settled.state
    : { status: 'loading' }
}

const SUCCESS = 'text-success-600 dark:text-success-400'
const WARNING = 'text-warning-600 dark:text-warning-400'

function blockerText(blocker: EvmSubmissionBlocker): string {
  switch (blocker.kind) {
    case 'nonce-gap':
      return `it would wait: the sender's next nonce is ${blocker.nextNonce.toString()}`
    case 'insufficient-balance':
      return `the sender holds ${blocker.balance.toString()} wei and it needs up to ${blocker.required.toString()} wei`
    case 'fee-below-base-fee':
      return `it would wait: its max fee is below the current base fee of ${blocker.baseFeePerGas.toString()} wei`
    default: {
      const exhaustive: never = blocker
      throw new Error(`unhandled submission blocker ${String(exhaustive)}`)
    }
  }
}

function Outcome({
  outcome,
}: {
  outcome: Extract<EvmTransactionStatusReport, { status: 'mined' }>['outcome']
}) {
  switch (outcome) {
    case 'succeeded':
      return (
        <Badge variant="outline" className={`border-current ${SUCCESS}`}>
          <CircleCheck />
          Success
        </Badge>
      )
    case 'reverted':
      return (
        <Badge variant="destructive">
          <CircleX />
          Reverted
        </Badge>
      )
    case 'unknown':
      return (
        <Tooltip>
          <TooltipTrigger render={<Badge variant="outline" />}>
            <CircleHelp />
            Included, outcome unknown
          </TooltipTrigger>
          <TooltipContent>
            This node holds the transaction and has pruned its receipt, which says whether it
            succeeded or reverted. Etherscan, or an archive node, has it.
          </TooltipContent>
        </Tooltip>
      )
    default: {
      const exhaustive: never = outcome
      throw new Error(`unhandled outcome ${String(exhaustive)}`)
    }
  }
}

function Report({
  report,
  checkedAt,
  broadcastUrl,
}: {
  report: EvmTransactionStatusReport
  checkedAt: number
  broadcastUrl: string
}) {
  switch (report.status) {
    case 'mined':
      return (
        <div className="basis-full">
          <DetailList>
            <DetailLine label="Status">
              <Outcome outcome={report.outcome} />
            </DetailLine>
            <DetailLine label="Block">
              <span className="flex flex-wrap items-center gap-1 tabular-nums">
                {report.blockNumber}
                <Badge variant="secondary">
                  {report.confirmations.toLocaleString('en-GB')} Block{' '}
                  {report.confirmations === 1 ? 'Confirmation' : 'Confirmations'}
                </Badge>
                <Badge variant="outline">{report.finalised ? 'Finalised' : 'Not finalised'}</Badge>
              </span>
            </DetailLine>
            <DetailLine label="Included">
              <span className="tabular-nums">
                {formatDuration(checkedAt - report.minedAt.getTime())} ago (
                {formatLocalTimestamp(report.minedAt)})
              </span>
            </DetailLine>
          </DetailList>
        </div>
      )
    case 'pending':
      return (
        <span className={`inline-flex items-center gap-1 ${WARNING}`}>
          <CircleAlert className="size-4" />
          submitted, waiting for a block
        </span>
      )
    case 'nonce-used':
      return (
        <span className={`inline-flex items-center gap-1 ${WARNING}`}>
          <CircleAlert className="size-4" />
          not found, and another transaction has used its nonce
        </span>
      )
    case 'not-found':
      return (
        <>
          <span className="text-muted-foreground inline-flex items-center gap-1">
            <CircleHelp className="size-4" />
            not found by this node
          </span>
          <div className="flex basis-full flex-wrap items-center gap-1">
            {report.blockers.length === 0 ? (
              <span className={`inline-flex items-center gap-1 ${SUCCESS}`}>
                <CircleCheck className="size-4" />
                still submittable
              </span>
            ) : (
              <span className={`inline-flex items-center gap-1 ${WARNING}`}>
                <CircleAlert className="size-4" />
                not submittable as things stand
              </span>
            )}
            <ExternalLinkButton href={broadcastUrl} label="Open in Etherscan's broadcast page" />
            {report.blockers.length > 0 && (
              <ul className="text-muted-foreground basis-full list-disc pl-5">
                {report.blockers.map((blocker) => (
                  <li key={blocker.kind}>{blockerText(blocker)}</li>
                ))}
              </ul>
            )}
          </div>
        </>
      )
    default: {
      const exhaustive: never = report
      throw new Error(`unhandled transaction status ${String(exhaustive)}`)
    }
  }
}

function hostOf(url: string): string {
  try {
    return new URL(url).host
  } catch {
    return url
  }
}

function Lookup({
  rpcUrl,
  transaction,
  broadcastUrl,
}: {
  rpcUrl: string
  transaction: EvmTransactionQuery
  broadcastUrl: string
}) {
  const [attempt, setAttempt] = useState(0)
  const state = useEvmTransactionStatus(rpcUrl, transaction, attempt)
  return (
    <>
      <InfoTooltip label="About the on chain status">
        <div className="flex max-w-xs flex-col gap-1">
          <p>
            Best effort: this is what one RPC node ({hostOf(rpcUrl)}) reports, never a source of
            truth.
          </p>
          <ul className="list-disc pl-4">
            <li>
              Not found does not mean not submitted. The node may never have seen the transaction,
              or dropped it from its pool while it was pending.
            </li>
            <li>
              Could not check does not mean not submitted. The node was unreachable or refused the
              call: set a keyed endpoint for this chain in the configuration and check again.
            </li>
            <li>
              Included is the timestamp of the block that holds the transaction. The chain does not
              record when a transaction was first sent to a node.
            </li>
            <li>
              Still submittable weighs the sender&apos;s nonce and balance and the latest base fee,
              as this node sees them. The link hands the signed transaction to Etherscan&apos;s
              broadcast page and sends nothing by itself. Broadcasting is permanent, and anyone
              holding a signed transaction can do it.
            </li>
            <li>
              Confirmations count blocks up to the node&apos;s head. Until its block is finalised, a
              reorganisation can still remove a transaction.
            </li>
          </ul>
        </div>
      </InfoTooltip>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label="Check the chain again"
              disabled={state.status === 'loading'}
              onClick={() => setAttempt((previous) => previous + 1)}
            />
          }
        >
          <RefreshCw />
        </TooltipTrigger>
        <TooltipContent>Check again</TooltipContent>
      </Tooltip>
      {state.status === 'loading' && <Spinner aria-label="Checking the chain" />}
      {state.status === 'loaded' && (
        <Report report={state.report} checkedAt={state.checkedAt} broadcastUrl={broadcastUrl} />
      )}
      {state.status === 'error' && (
        <span className="text-muted-foreground inline-flex items-center gap-1">
          <CircleHelp className="size-4" />
          could not check: {state.error}
        </span>
      )}
    </>
  )
}

/**
 * What the configured RPC node of the transaction's chain reports about it: one node's view, shown
 * with its caveats.
 */
export function EvmTransactionStatus({
  chainId,
  transaction,
  signedTransaction,
}: {
  chainId: bigint
  transaction: EvmTransactionQuery
  /** The raw signed transaction, offered for broadcast while the node does not know it. */
  signedTransaction: string
}) {
  const { network, config } = useMidnight()
  const rpcUrl = evmRpcUrl(config, chainId)
  return (
    <div className="flex flex-wrap items-center gap-1">
      <span className="font-bold">On Chain:</span>
      {rpcUrl === null ? (
        <span className="text-muted-foreground">
          no RPC endpoint configured for chain {chainId.toString()}
        </span>
      ) : (
        <Lookup
          rpcUrl={rpcUrl}
          transaction={transaction}
          broadcastUrl={etherscanBroadcastUrl(network, signedTransaction)}
        />
      )}
    </div>
  )
}
