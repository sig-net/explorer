import type { IndexedSignetMiscEvent } from '@sig-net/midnight'
import { DateTime } from 'luxon'
import type { ReactNode } from 'react'
import { expect, test } from 'vitest'
import { render } from 'vitest-browser-react'

import '@/index.css'
import { SignetEventsSection } from './signet-events-section'

// Rendered in Asia/Kolkata (UTC+05:30), the test browser's zone set in vite.config.ts.
const START = DateTime.fromISO('2026-09-07T12:00:00Z')

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
    blockTimestamp: START.plus({ seconds: id }).toJSDate(),
  }
}

interface SourcedEvent {
  readonly source: IndexedSignetMiscEvent
}

function events(count: number): SourcedEvent[] {
  return Array.from({ length: count }, (_, index) => ({ source: source(index + 1) }))
}

function renderRecord(event: SourcedEvent): ReactNode {
  return <p>record of event {event.source.id}</p>
}

test('a kind with no events shows as pending, without tabs', async () => {
  const screen = await render(
    <SignetEventsSection heading="Kind" events={[]} renderRecord={renderRecord} />,
  )
  await expect.element(screen.getByRole('heading', { name: 'Kind' })).toBeVisible()
  await expect.element(screen.getByRole('img', { name: 'Pending' })).toBeVisible()
  expect(screen.getByRole('tablist').elements()).toHaveLength(0)
})

test('each event gets a numbered tab showing where it was emitted and its record', async () => {
  const screen = await render(
    <SignetEventsSection heading="Kind" events={events(2)} renderRecord={renderRecord} />,
  )
  await expect.element(screen.getByRole('tab', { name: '1' })).toHaveAttribute('aria-selected')
  await expect.element(screen.getByText('07-09-26 17:30:01')).toBeVisible()
  await expect.element(screen.getByText('1001', { exact: true })).toBeVisible()
  await expect.element(screen.getByText('record of event 1')).toBeVisible()
  await expect.element(screen.getByRole('button', { name: 'Copy block height' })).toBeVisible()
  await screen.getByRole('tab', { name: '2' }).click()
  await expect.element(screen.getByText('07-09-26 17:30:02')).toBeVisible()
  expect(screen.getByText('07-09-26 17:30:01').elements()).toHaveLength(0)
})

test('tabs that fit have no scroll buttons', async () => {
  const screen = await render(
    <div style={{ width: 400 }}>
      <SignetEventsSection heading="Kind" events={events(3)} renderRecord={renderRecord} />
    </div>,
  )
  await expect.element(screen.getByRole('tab', { name: '3' })).toBeVisible()
  expect(screen.getByRole('button', { name: /Scroll tabs/ }).elements()).toHaveLength(0)
})

test('overflowing tabs scroll with a button at each end', async () => {
  const screen = await render(
    <div style={{ width: 400 }}>
      <SignetEventsSection heading="Kind" events={events(30)} renderRecord={renderRecord} />
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

test('the first successful event is selected until a tab is picked by hand', async () => {
  const screen = await render(
    <SignetEventsSection heading="Kind" events={events(4)} renderRecord={renderRecord} />,
  )
  await expect
    .element(screen.getByRole('tab', { name: '1' }))
    .toHaveAttribute('aria-selected', 'true')

  await screen.rerender(
    <SignetEventsSection
      heading="Kind"
      events={events(4)}
      renderRecord={renderRecord}
      successfulEventIds={new Set([2, 3])}
    />,
  )
  await expect
    .element(screen.getByRole('tab', { name: '2' }))
    .toHaveAttribute('aria-selected', 'true')
  await expect.element(screen.getByText('record of event 2')).toBeVisible()
  await expect.element(screen.getByRole('tab', { name: '2' })).toHaveAttribute('data-successful')
  await expect.element(screen.getByRole('tab', { name: '3' })).toHaveAttribute('data-successful')
  await expect
    .element(screen.getByRole('tab', { name: '1' }))
    .not.toHaveAttribute('data-successful')

  await screen.getByRole('tab', { name: '4' }).click()
  await screen.rerender(
    <SignetEventsSection
      heading="Kind"
      events={events(4)}
      renderRecord={renderRecord}
      successfulEventIds={new Set([3])}
    />,
  )
  await expect
    .element(screen.getByRole('tab', { name: '4' }))
    .toHaveAttribute('aria-selected', 'true')
})
