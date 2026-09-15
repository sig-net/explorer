import { expect, test } from 'vitest'
import { page } from 'vitest/browser'
import { render } from 'vitest-browser-react'

import { Counter } from './Counter'

test('increments when clicked', async () => {
  await render(<Counter />)

  const button = page.getByRole('button', { name: /count is 0/i })
  await expect.element(button).toBeVisible()

  await button.click()

  await expect.element(page.getByRole('button', { name: /count is 1/i })).toBeVisible()
})
