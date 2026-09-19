import { Fragment } from 'react'

import { useMidnight } from '@/components/contexts/MidnightContext'
import { CopyableHex } from '@/components/copyable-hex'
import { DetailLine, DetailList } from '@/components/detail-list'
import { ExternalLinkButton } from '@/components/external-link-button'
import { SignBidirectionalRequestJson } from '@/components/midnight/sign-bidirectional-request-json'
import { useSignBidirectionalTransactionInspection } from '@/components/midnight/use-sign-bidirectional-transaction-inspection'
import { PendingIcon } from '@/components/pending-icon'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { etherscanAddressUrl } from '@/lib/midnight/evm-block-explorer'
import { deriveRequestSigningKey } from '@/lib/midnight/request-signing-key'
import type { ContractCallNode } from '@/lib/midnight/sign-bidirectional-transaction-inspection'
import type { SignBidirectionalNotificationEvent } from '@/lib/midnight/sign-bidirectional-transaction-loader'

function CallChain({ calls }: { calls: readonly ContractCallNode[] }) {
  return (
    <ul className="list-disc pl-5">
      {calls.map((call, index) => (
        <li key={index}>
          <span className="flex flex-wrap items-center gap-x-2">
            <span className="min-w-0 font-mono break-all">{call.entryPoint}</span>@
            <CopyableHex value={call.address} label={`${call.entryPoint} contract address`} />
            {call.fallible && (
              <Tooltip>
                <TooltipTrigger render={<Badge variant="destructive" />}>fallible</TooltipTrigger>
                <TooltipContent>
                  Runs in the transaction's fallible section. The MPC reads guaranteed transcripts
                  only, so it skips a Signet call made this way.
                </TooltipContent>
              </Tooltip>
            )}
          </span>
          {call.calls.length > 0 && <CallChain calls={call.calls} />}
        </li>
      ))}
    </ul>
  )
}

/**
 * What the transaction that emitted a sign bidirectional notification did: the chain of contract
 * calls under each of its top level calls, and the request record it stored in the caller, with the
 * key the MPC signs that request with.
 */
export function SignBidirectionalTransactionDetails({
  event,
}: {
  event: SignBidirectionalNotificationEvent
}) {
  const state = useSignBidirectionalTransactionInspection(event)
  const { network, config } = useMidnight()

  if (state.status === 'loading') {
    return <PendingIcon />
  }
  if (state.status === 'error') {
    return <p className="text-destructive">Could not inspect the transaction: {state.error}</p>
  }
  const { callChains, request } = state.inspection
  const signingKey =
    request === null ? null : deriveRequestSigningKey(config.mpcRootPublicKey, request)
  return (
    <>
      <h4 className="font-bold">Call Chain</h4>
      {callChains.map((chain, index) => (
        <Fragment key={index}>
          {index > 0 && <Separator />}
          <CallChain calls={[chain]} />
        </Fragment>
      ))}
      <Separator />
      <h4 className="font-bold">Request at Path in Caller</h4>
      {request === null ? (
        <p className="text-muted-foreground">The transaction stores no request at this path</p>
      ) : (
        <>
          <DetailList>
            {signingKey === null ? (
              <DetailLine label="Signing Key">
                <span className="text-muted-foreground">
                  Needs a valid MPC root public key in the configuration
                </span>
              </DetailLine>
            ) : (
              <>
                <DetailLine
                  label="Signing Key"
                  info="The secp256k1 public key the MPC signs this request's transaction with. The MPC derives it from its root public key, the requesting contract's address and the request's path, so each contract and path has a key of its own."
                >
                  <CopyableHex value={signingKey.publicKey} label="signing key" />
                </DetailLine>
                <DetailLine
                  label="Signing Key Address"
                  info="The Ethereum address of the signing key: the last 20 bytes of the Keccak-256 hash of the public key. It is the account the signed transaction is sent from, so it pays that transaction's gas."
                >
                  <span className="flex flex-wrap items-center gap-1">
                    <CopyableHex value={signingKey.evmAddress} label="signing key address" />
                    <ExternalLinkButton
                      href={etherscanAddressUrl(network, signingKey.evmAddress)}
                      label="Open signing key address on Etherscan"
                    />
                  </span>
                </DetailLine>
              </>
            )}
          </DetailList>
          <SignBidirectionalRequestJson request={request} />
        </>
      )}
    </>
  )
}
