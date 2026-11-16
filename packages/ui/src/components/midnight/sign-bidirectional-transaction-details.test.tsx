import type {
  InspectedSignBidirectionalEvent,
  SignBidirectionalInspection,
} from '@sig-net/explorer-api'
import { notificationEvent } from '@sig-net/explorer-lib/testing'
import { expect, test } from 'vitest'
import { render } from 'vitest-browser-react'

import '@/index.css'
import { ExplorerApiProvider } from '@/components/contexts/ExplorerApiContext'
import { MidnightProvider } from '@/components/contexts/MidnightContext'
import { ThemeProvider } from '@/components/contexts/ThemeContext'
import { TooltipProvider } from '@/components/ui/tooltip'
import { inspectedLifecycle } from '@/lib/midnight/inspected-sign-bidirectional-lifecycle.fixture'
import { SIGNED_REQUEST, SIGNED_REQUEST_ID } from '@/lib/midnight/sign-bidirectional-event.fixture'

import { SignBidirectionalTransactionDetails } from './sign-bidirectional-transaction-details'

const CALLER = 'ca'.repeat(32)
const SIGNER = '51'.repeat(32)

function inspectedNotification(
  inspection: SignBidirectionalInspection,
): InspectedSignBidirectionalEvent {
  const [event] = inspectedLifecycle(
    [notificationEvent(1, SIGNED_REQUEST_ID, new Uint8Array(32).fill(0xca), 0)],
    inspection,
  ).signBidirectionalEvents
  if (event === undefined) {
    throw new Error('expected a notification')
  }
  return event
}

function renderDetails(event: InspectedSignBidirectionalEvent) {
  return render(
    <ThemeProvider>
      <ExplorerApiProvider service={null}>
        <MidnightProvider>
          <TooltipProvider>
            <SignBidirectionalTransactionDetails event={event} />
          </TooltipProvider>
        </MidnightProvider>
      </ExplorerApiProvider>
    </ThemeProvider>,
  )
}

test('shows the call chains and the request of an inspection', async () => {
  const screen = await renderDetails(
    inspectedNotification({
      callChains: [
        {
          entryPoint: 'sendDeposit',
          address: CALLER,
          fallible: true,
          calls: [{ entryPoint: 'signBidirectional', address: SIGNER, fallible: true, calls: [] }],
        },
      ],
      request: SIGNED_REQUEST,
      requestCell: null,
    }),
  )
  await expect.element(screen.getByRole('heading', { name: 'Call Chain' })).toBeVisible()
  await expect.element(screen.getByText('sendDeposit', { exact: true })).toBeVisible()
  await expect.element(screen.getByText('signBidirectional', { exact: true })).toBeVisible()
  await expect
    .element(screen.getByRole('heading', { name: 'Request at Path in Caller' }))
    .toBeVisible()
  const text = screen.container.textContent
  expect(text).toContain('caca...caca')
  expect(text).toContain('5151...5151')
  expect(text).toContain('11155111')
  expect(text).not.toContain('stores no request')
})

test('shows the reason of a failed inspection', async () => {
  const screen = await renderDetails(
    inspectedNotification({ failed: 'the transaction did not deserialise' }),
  )
  await expect
    .element(
      screen.getByText('Could not inspect the transaction: the transaction did not deserialise'),
    )
    .toBeVisible()
  expect(screen.getByRole('heading', { name: 'Call Chain' }).elements()).toHaveLength(0)
})
