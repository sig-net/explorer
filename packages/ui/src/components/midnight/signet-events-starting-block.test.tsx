import { expect, test, vi } from 'vitest'
import { userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'

import '@/index.css'
import { TooltipProvider } from '@/components/ui/tooltip'

import { SignetEventsStartingBlock } from './signet-events-starting-block'

test('the resolved block is shown, and the button steps back', async () => {
  const onStepBack = vi.fn<() => void>()
  const screen = await render(
    <TooltipProvider>
      <SignetEventsStartingBlock
        startingBlock={{ status: 'resolved', block: 948729, automatic: true, floor: 0 }}
        canStepBack
        onChange={() => {}}
        onStepBack={onStepBack}
      />
    </TooltipProvider>,
  )
  const field = screen.getByLabelText('Starting Block')
  await expect.element(field).toHaveValue('948729')
  await screen.getByRole('button', { name: 'Read from half a day of blocks earlier' }).click()
  expect(onStepBack).toHaveBeenCalledTimes(1)
})

test('an edit reaches the change handler on Enter once it is a block height, and marks itself invalid otherwise', async () => {
  const onChange = vi.fn<(value: string) => void>()
  const screen = await render(
    <TooltipProvider>
      <SignetEventsStartingBlock
        startingBlock={{ status: 'resolved', block: 948729, automatic: false, floor: 0 }}
        canStepBack
        onChange={onChange}
        onStepBack={() => {}}
      />
    </TooltipProvider>,
  )
  const field = screen.getByLabelText('Starting Block')
  await field.fill('12x')
  await userEvent.keyboard('{Enter}')
  await expect.element(field).toHaveAttribute('aria-invalid', 'true')
  expect(onChange).not.toHaveBeenCalled()
  await field.fill(' 900000 ')
  await userEvent.keyboard('{Enter}')
  expect(onChange).toHaveBeenCalledWith('900000')
})

test('while the tip is being read the field is empty and the step back is off', async () => {
  const screen = await render(
    <TooltipProvider>
      <SignetEventsStartingBlock
        startingBlock={{ status: 'resolving' }}
        canStepBack={false}
        onChange={() => {}}
        onStepBack={() => {}}
      />
    </TooltipProvider>,
  )
  await expect.element(screen.getByLabelText('Starting Block')).toHaveValue('')
  await expect
    .element(screen.getByRole('button', { name: 'Read from half a day of blocks earlier' }))
    .toBeDisabled()
})
