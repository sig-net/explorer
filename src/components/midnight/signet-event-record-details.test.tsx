import type { MpcSignature } from '@sig-net/midnight'
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

test.for([
  ['signature responded event', SignatureRespondedEventDetails],
  ['respond bidirectional event', RespondBidirectionalEventDetails],
] as const)('a %s shows every signature field', async ([, Details]) => {
  const screen = await render(
    <TooltipProvider>
      <Details record={{ signature: SIGNATURE }} />
    </TooltipProvider>,
  )
  await expect.element(screen.getByText(truncateMiddle('a1'.repeat(32)))).toBeVisible()
  await expect.element(screen.getByText(truncateMiddle('b2'.repeat(32)))).toBeVisible()
  await expect.element(screen.getByText(truncateMiddle('c3'.repeat(32)))).toBeVisible()
  await expect.element(screen.getByText('1', { exact: true })).toBeVisible()
})
