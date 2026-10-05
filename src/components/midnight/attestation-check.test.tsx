import { OutputKind } from '@sig-net/midnight'
import { expect, test } from 'vitest'
import { render } from 'vitest-browser-react'

import '@/index.css'
import { ThemeProvider } from '@/components/contexts/ThemeContext'
import { TooltipProvider } from '@/components/ui/tooltip'
import { truncateMiddle } from '@/lib/format'
import type { AttestationCheck as AttestationCheckResult } from '@/lib/midnight/attestation-check'

import { AttestationCheck } from './attestation-check'

const RESPONSE_KEY = `0x04${'ab'.repeat(64)}`

function renderCheck(check: AttestationCheckResult) {
  return render(
    <ThemeProvider>
      <TooltipProvider>
        <AttestationCheck
          checks={{ status: 'checked', checks: new Map([[7, check]]) }}
          eventId={7}
        />
      </TooltipProvider>
    </ThemeProvider>,
  )
}

test('a valid executed attestation shows its verdict, bytes, source and decoded output', async () => {
  const screen = await renderCheck({
    status: 'valid',
    responseKey: RESPONSE_KEY,
    outputKind: OutputKind.executed,
    blockHeight: 9_000_000n,
    output: {
      source: 'evm-node',
      decodedOutput: { success: true },
      serializedOutput: new Uint8Array([1]),
    },
  })
  await expect
    .element(
      screen.getByText(
        'The MPC attests that the foreign transaction executed, finalised in destination block 9000000.',
      ),
    )
    .toBeVisible()
  await expect.element(screen.getByText(truncateMiddle(RESPONSE_KEY))).toBeVisible()
  await expect.element(screen.getByText('01', { exact: true })).toBeVisible()
  await expect.element(screen.getByText('Recovered Output', { exact: true })).toBeVisible()
  const text = screen.container.textContent
  expect(text).toContain('valid for response key')
  expect(text).not.toContain('not valid for response key')
  expect(text).toContain('Output Source:a trace of the transaction on the EVM node')
})

test.for([
  [
    OutputKind.failed,
    'The MPC attests that the foreign transaction reverted, finalised in destination block 12, so there is no output.',
  ],
  [
    OutputKind.unviable,
    "The MPC attests that another transaction, finalised in destination block 12, took the request's nonce, so the requested transaction cannot execute and there is no output.",
  ],
] as const)(
  'a valid attestation of output kind %s over an empty output shows its verdict and no source',
  async ([outputKind, verdict]) => {
    const screen = await renderCheck({
      status: 'valid',
      responseKey: RESPONSE_KEY,
      outputKind,
      blockHeight: 12n,
      output: null,
    })
    await expect.element(screen.getByText(verdict, { exact: true })).toBeVisible()
    await expect.element(screen.getByText('none', { exact: true })).toBeVisible()
    const text = screen.container.textContent
    expect(text).not.toContain('Output Source:')
    expect(text).not.toContain('Recovered Output')
  },
)

test('an invalid attestation shows the reason', async () => {
  const screen = await renderCheck({
    status: 'invalid',
    responseKey: RESPONSE_KEY,
    reason: 'the attestation is not over the traced output',
  })
  await expect
    .element(screen.getByText('the attestation is not over the traced output'))
    .toBeVisible()
  expect(screen.container.textContent).toContain('not valid for response key')
})

test('an event with no check yet shows no verdict', async () => {
  const screen = await render(
    <TooltipProvider>
      <AttestationCheck checks={{ status: 'loading' }} eventId={7} />
    </TooltipProvider>,
  )
  await expect.element(screen.getByText('Attestation Check')).toBeVisible()
  expect(screen.container.textContent).not.toContain('valid for response key')
})
