import type { SignatureRespondedEvent } from '@sig-net/midnight'
import { CircleCheck, CircleX } from 'lucide-react'

import { useMidnight } from '@/components/contexts/MidnightContext'
import { CopyButton } from '@/components/copy-button'
import { CopyableHex } from '@/components/copyable-hex'
import { ExternalLinkButton } from '@/components/external-link-button'
import { EvmTransactionStatus } from '@/components/midnight/evm-transaction-status'
import { useSignBidirectionalTransactionInspection } from '@/components/midnight/use-sign-bidirectional-transaction-inspection'
import { PendingIcon } from '@/components/pending-icon'
import type { SignBidirectionalNotificationEvent } from '@/lib/midnight/sign-bidirectional-transaction-loader'
import { etherscanTransactionUrl } from '@/lib/midnight/evm-block-explorer'
import { checkSignature } from '@/lib/midnight/signature-check'
import { truncateMiddle } from '@/lib/format'

function NotificationSignatureCheck({
  notification,
  response,
}: {
  notification: SignBidirectionalNotificationEvent
  response: SignatureRespondedEvent
}) {
  const state = useSignBidirectionalTransactionInspection(notification)
  const { network, config } = useMidnight()

  if (state.status === 'loading') {
    return <PendingIcon />
  }
  if (state.status === 'error') {
    return <span className="text-destructive">could not inspect its transaction</span>
  }
  const { request } = state.inspection
  if (request === null) {
    return <span className="text-muted-foreground">its transaction stores no request</span>
  }
  const check = checkSignature(config.mpcRootPublicKey, request, response)
  if (check.status === 'no-root-key') {
    return (
      <span className="text-muted-foreground">
        needs a valid MPC root public key in the configuration
      </span>
    )
  }
  if (check.status === 'invalid') {
    return (
      <span className="text-destructive inline-flex flex-wrap items-center gap-1">
        not valid for key
        <CopyableHex value={check.signingKey.publicKey} label="signing key" />
        <CircleX className="size-4" />
      </span>
    )
  }
  return (
    <>
      <span className="text-success-600 dark:text-success-400 inline-flex flex-wrap items-center gap-1">
        valid for key
        <CopyableHex value={check.signingKey.publicKey} label="signing key" />
        <CircleCheck className="size-4" />
      </span>
      <span className="flex flex-wrap items-center gap-1">
        <span className="font-bold">EVM Txn Hash:</span>
        <CopyableHex value={check.evmTransactionHash} label="EVM transaction hash" />
        <ExternalLinkButton
          href={etherscanTransactionUrl(network, check.evmTransactionHash)}
          label="Open transaction on Etherscan"
        />
      </span>
      <span className="flex flex-wrap items-center gap-1">
        <span className="font-bold">Signed Txn:</span>
        <span className="font-mono">{truncateMiddle(check.signedEvmTransaction)}</span>
        <CopyButton value={check.signedEvmTransaction} label="signed EVM transaction" />
      </span>
      <EvmTransactionStatus
        chainId={request.txParams.chainId}
        signedTransaction={check.signedEvmTransaction}
        transaction={{
          hash: check.evmTransactionHash,
          from: check.signingKey.evmAddress,
          nonce: request.txParams.nonce,
          gasLimit: request.txParams.gasLimit,
          maxFeePerGas: request.txParams.maxFeePerGas,
          value: request.txParams.value,
        }}
      />
    </>
  )
}

/**
 * Whether a posted signature is by the signing key of each sign bidirectional notification of its
 * lifecycle, numbered as the notification tabs are.
 */
export function SignatureCheck({
  notifications,
  response,
}: {
  notifications: readonly SignBidirectionalNotificationEvent[]
  response: SignatureRespondedEvent
}) {
  return (
    <>
      <h4 className="font-bold">Signature Check</h4>
      {notifications.length === 0 ? (
        <p className="text-muted-foreground">No sign bidirectional notification to check against</p>
      ) : (
        <ol className="list-decimal pl-5">
          {notifications.map((notification) => (
            <li key={notification.source.id}>
              <NotificationSignatureCheck notification={notification} response={response} />
            </li>
          ))}
        </ol>
      )}
    </>
  )
}
