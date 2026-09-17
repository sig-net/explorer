import type { IndexedSignetMiscEvent } from '@sig-net/midnight'
import { expect, test } from 'vitest'
import { render } from 'vitest-browser-react'

import '@/index.css'
import { SignetEventSourcesSection } from './signet-event-sources-section'

const START = Date.UTC(2026, 8, 7, 12, 0, 0)

function source(id: number): IndexedSignetMiscEvent {
  return {
    name: 'SignBidirectionalEvent',
    payload: new Uint8Array(256),
    id,
    maxId: 100,
    transactionId: id,
    transactionHash: id.toString(16).padStart(64, '0'),
    blockHeight: 1000 + id,
    blockHash: 'c0'.repeat(32),
    blockTimestamp: new Date(START + id * 1000),
  }
}

function sources(count: number): IndexedSignetMiscEvent[] {
  return Array.from({ length: count }, (_, index) => source(index + 1))
}

test('a kind with no events shows as pending, without tabs', async () => {
  const screen = await render(<SignetEventSourcesSection heading="Kind" sources={[]} />)
  await expect.element(screen.getByRole('heading', { name: 'Kind' })).toBeVisible()
  await expect.element(screen.getByRole('img', { name: 'Pending' })).toBeVisible()
  expect(screen.getByRole('tablist').elements()).toHaveLength(0)
})

test('each event gets a numbered tab showing where it was emitted', async () => {
  const screen = await render(<SignetEventSourcesSection heading="Kind" sources={sources(2)} />)
  await expect.element(screen.getByRole('tab', { name: '1' })).toHaveAttribute('aria-selected')
  await expect.element(screen.getByText('07-09-26 12:00:01')).toBeVisible()
  await screen.getByRole('tab', { name: '2' }).click()
  await expect.element(screen.getByText('07-09-26 12:00:02')).toBeVisible()
  expect(screen.getByText('07-09-26 12:00:01').elements()).toHaveLength(0)
})

test('tabs that fit have no scroll buttons', async () => {
  const screen = await render(
    <div style={{ width: 400 }}>
      <SignetEventSourcesSection heading="Kind" sources={sources(3)} />
    </div>,
  )
  await expect.element(screen.getByRole('tab', { name: '3' })).toBeVisible()
  expect(screen.getByRole('button', { name: /Scroll tabs/ }).elements()).toHaveLength(0)
})

test('overflowing tabs scroll with a button at each end', async () => {
  const screen = await render(
    <div style={{ width: 400 }}>
      <SignetEventSourcesSection heading="Kind" sources={sources(30)} />
    </div>,
  )
  const back = screen.getByRole('button', { name: 'Scroll tabs back' })
  const forward = screen.getByRole('button', { name: 'Scroll tabs forward' })
  await expect.element(back).toBeDisabled()
  await expect.element(forward).toBeEnabled()
  await forward.click()
  await expect.element(back).toBeEnabled()
  await expect.poll(() => screen.getByRole('tablist').element().scrollLeft).toBeGreaterThan(0)
})
