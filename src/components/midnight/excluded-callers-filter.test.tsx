import { useState } from 'react'
import { expect, test } from 'vitest'
import { userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'

import '@/index.css'
import { ExcludedCallersFilter } from './excluded-callers-filter'

const ONE = '11'.repeat(32)
const TWO = '22'.repeat(32)
const THREE = '33'.repeat(32)

/** The filter with the excluded callers held as the page holds them. */
function Harness({ callers }: { callers: readonly string[] }) {
  const [excluded, setExcluded] = useState<readonly string[]>([])
  return (
    <ExcludedCallersFilter
      callers={callers}
      excluded={excluded}
      onExclude={(caller) =>
        setExcluded((current) => (current.includes(caller) ? current : [...current, caller]))
      }
      onRestore={(caller) => setExcluded((current) => current.filter((other) => other !== caller))}
    />
  )
}

test('a seen caller is offered as the typed fragment narrows them, and a pick excludes it', async () => {
  const screen = await render(<Harness callers={[ONE, TWO]} />)
  const box = screen.getByRole('combobox', { name: 'Exclude callers' })
  await box.fill('22')
  await expect.element(screen.getByRole('option', { name: TWO })).toBeVisible()
  expect(screen.getByRole('option', { name: ONE }).elements()).toHaveLength(0)
  await screen.getByRole('option', { name: TWO }).click()
  await expect.element(screen.getByRole('button', { name: `Stop excluding ${TWO}` })).toBeVisible()
  await expect.element(box).toHaveValue('')
  // An excluded caller is not offered again.
  await box.fill('2')
  expect(screen.getByRole('option', { name: TWO }).elements()).toHaveLength(0)
})

test('Enter picks the highlighted caller, and excludes a typed address when none is offered', async () => {
  const screen = await render(<Harness callers={[ONE]} />)
  const box = screen.getByRole('combobox', { name: 'Exclude callers' })
  await box.fill('0x11')
  await userEvent.keyboard('{Enter}')
  await expect.element(screen.getByRole('button', { name: `Stop excluding ${ONE}` })).toBeVisible()
  await box.fill(` 0x${THREE.toUpperCase()} `)
  await userEvent.keyboard('{Enter}')
  await expect
    .element(screen.getByRole('button', { name: `Stop excluding ${THREE}` }))
    .toBeVisible()
  await expect.element(box).toHaveValue('')
})

test('the button excludes the typed address, and marks the box when it is not one', async () => {
  const screen = await render(<Harness callers={[]} />)
  const box = screen.getByRole('combobox', { name: 'Exclude callers' })
  const button = screen.getByRole('button', { name: 'Exclude the typed caller' })
  // While the suggestions are open, the rest of the page is hidden from the accessibility tree.
  await box.fill('not an address')
  await userEvent.keyboard('{Escape}')
  await button.click()
  await expect.element(box).toHaveAttribute('aria-invalid', 'true')
  expect(screen.getByRole('list', { name: 'Excluded callers' }).elements()).toHaveLength(0)
  await box.fill(TWO)
  await expect.element(box).not.toHaveAttribute('aria-invalid')
  await userEvent.keyboard('{Escape}')
  await button.click()
  await expect.element(screen.getByRole('button', { name: `Stop excluding ${TWO}` })).toBeVisible()
  await expect.element(screen.getByText('2222...2222')).toBeVisible()
})

test('a chip lets its caller back in', async () => {
  const screen = await render(<Harness callers={[]} />)
  const box = screen.getByRole('combobox', { name: 'Exclude callers' })
  await box.fill(ONE)
  await userEvent.keyboard('{Enter}')
  await box.fill(TWO)
  await userEvent.keyboard('{Enter}')
  await screen.getByRole('button', { name: `Stop excluding ${ONE}` }).click()
  expect(screen.getByRole('button', { name: `Stop excluding ${ONE}` }).elements()).toHaveLength(0)
  await expect.element(screen.getByRole('button', { name: `Stop excluding ${TWO}` })).toBeVisible()
})
