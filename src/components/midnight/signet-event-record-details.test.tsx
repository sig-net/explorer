import { type MpcSignature, OutputKind } from '@sig-net/midnight'
import { expect, test } from 'vitest'
import { render } from 'vitest-browser-react'

import '@/index.css'
import { TooltipProvider } from '@/components/ui/tooltip'
import { truncateMiddle } from '@/lib/format'

import {
  RespondBidirectionalEventDetails,
  SignatureRespondedEventDetails,
  SignBidirectionalNotificationDetails,
} from './signet-event-record-details'

const SIGNATURE: MpcSignature = {
  bigR: { x: new Uint8Array(32).fill(0xa1), y: new Uint8Array(32).fill(0xb2) },
  s: new Uint8Array(32).fill(0xc3),
  recoveryId: 1n,
}

test('a notification shows its version, caller and requests path', async () => {
  const callerAddress = 'ca'.repeat(32)
  const screen = await render(
    <TooltipProvider>
      <SignBidirectionalNotificationDetails
        record={{ version: 1, callerAddress, requestsPath: [1, 14] }}
      />
    </TooltipProvider>,
  )
  await expect.element(screen.getByText('Version:')).toBeVisible()
  await expect.element(screen.getByText(truncateMiddle(callerAddress))).toBeVisible()
  await expect.element(screen.getByText('2', { exact: true })).toBeVisible()
  await expect.element(screen.getByText('[1, 14]')).toBeVisible()
})

const REQUEST_ID = new Uint8Array(32).fill(0xd4)
const REQUEST_ID_AND_SIGNATURE_TEXTS = [
  truncateMiddle('d4'.repeat(32)),
  truncateMiddle('a1'.repeat(32)),
  truncateMiddle('b2'.repeat(32)),
  truncateMiddle('c3'.repeat(32)),
  '1',
]

test('a signature responded event shows its request id and every signature field', async () => {
  const screen = await render(
    <TooltipProvider>
      <SignatureRespondedEventDetails record={{ requestId: REQUEST_ID, signature: SIGNATURE }} />
    </TooltipProvider>,
  )
  for (const text of REQUEST_ID_AND_SIGNATURE_TEXTS) {
    await expect.element(screen.getByText(text, { exact: true })).toBeVisible()
  }
})

test('a respond bidirectional event shows what it attests and every signature field', async () => {
  const screen = await render(
    <TooltipProvider>
      <RespondBidirectionalEventDetails
        record={{
          requestId: REQUEST_ID,
          blockHeight: 9_000_000n,
          outputKind: OutputKind.unviable,
          serializedOutputLength: 33n,
          digest: new Uint8Array(32).fill(0xe5),
          signature: SIGNATURE,
        }}
      />
    </TooltipProvider>,
  )
  for (const text of [
    ...REQUEST_ID_AND_SIGNATURE_TEXTS,
    '9000000',
    'Unviable',
    '33',
    truncateMiddle('e5'.repeat(32)),
  ]) {
    await expect.element(screen.getByText(text, { exact: true })).toBeVisible()
  }
})
