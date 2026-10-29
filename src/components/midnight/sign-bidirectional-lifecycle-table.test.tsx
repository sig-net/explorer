import { SignetEventName } from '@sig-net/midnight'
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRouter,
} from '@tanstack/react-router'
import { expect, test } from 'vitest'
import { render } from 'vitest-browser-react'

import '@/index.css'
import { MidnightProvider } from '@/components/contexts/MidnightContext'
import { TooltipProvider } from '@/components/ui/tooltip'
import {
  aggregateSignBidirectionalLifecycles,
  type SignBidirectionalLifecycle,
} from '@/lib/midnight/sign-bidirectional-lifecycle'
import { responseEvent } from '@/lib/midnight/sign-bidirectional-lifecycle.fixture'

import { SignBidirectionalLifecycleTable } from './sign-bidirectional-lifecycle-table'

const REQUEST = new Uint8Array(32).fill(0xaa)

const SPLASH_TITLE = 'Looking back through Sig Network events for this request'
const LOADING_TITLE = 'Loading Sig Network events'
const MISSING_NOTIFICATION = /No Sign Bidirectional Event on this contract declares this request id/

/** A lifecycle found by its attestation alone, as the newest-first read finds an old request. */
function attestedOnly(): SignBidirectionalLifecycle {
  const [lifecycle] = aggregateSignBidirectionalLifecycles([
    responseEvent(1, SignetEventName.RespondBidirectionalEvent, REQUEST, 0),
  ])
  if (lifecycle === undefined) {
    throw new Error('expected a lifecycle')
  }
  return lifecycle
}

/** A row's link button builds its href through the router, so rows render inside one. */
function renderWithRows(lifecycles: readonly SignBidirectionalLifecycle[], searching: boolean) {
  const routeTree = createRootRoute({
    component: () => (
      <MidnightProvider>
        <TooltipProvider>
          <SignBidirectionalLifecycleTable
            lifecycles={lifecycles}
            emptyText="No requests match the search"
            expandSoleRow
            searching={searching}
            loading={false}
            filterPanel={null}
          />
        </TooltipProvider>
      </MidnightProvider>
    ),
  })
  const router = createRouter({ routeTree, history: createMemoryHistory() })
  return render(<RouterProvider router={router} />)
}

test('an empty body shows the search while it runs, and the empty text once it is over', async () => {
  const screen = await render(
    <SignBidirectionalLifecycleTable
      lifecycles={[]}
      emptyText="No requests match the search"
      expandSoleRow
      searching
      loading
      filterPanel={null}
    />,
  )
  await expect.element(screen.getByText(SPLASH_TITLE)).toBeVisible()
  await expect.element(screen.getByRole('status', { name: 'Searching' })).toBeVisible()
  expect(screen.getByText(LOADING_TITLE).elements()).toHaveLength(0)
  expect(screen.getByText('No requests match the search').elements()).toHaveLength(0)

  await screen.rerender(
    <SignBidirectionalLifecycleTable
      lifecycles={[]}
      emptyText="No requests match the search"
      expandSoleRow
      searching={false}
      loading={false}
      filterPanel={null}
    />,
  )
  await expect.element(screen.getByText('No requests match the search')).toBeVisible()
  expect(screen.getByText(SPLASH_TITLE).elements()).toHaveLength(0)
  expect(screen.getByRole('status', { name: 'Searching' }).elements()).toHaveLength(0)
})

test('an empty body shows the load while the events are read, and the empty text once they are', async () => {
  const screen = await render(
    <SignBidirectionalLifecycleTable
      lifecycles={[]}
      emptyText="No requests yet"
      expandSoleRow
      searching={false}
      loading
      filterPanel={null}
    />,
  )
  await expect.element(screen.getByText(LOADING_TITLE)).toBeVisible()
  await expect.element(screen.getByRole('status', { name: 'Loading' })).toBeVisible()
  expect(screen.getByText('No requests yet').elements()).toHaveLength(0)

  await screen.rerender(
    <SignBidirectionalLifecycleTable
      lifecycles={[]}
      emptyText="No requests yet"
      expandSoleRow
      searching={false}
      loading={false}
      filterPanel={null}
    />,
  )
  await expect.element(screen.getByText('No requests yet')).toBeVisible()
  expect(screen.getByText(LOADING_TITLE).elements()).toHaveLength(0)
  expect(screen.getByRole('status', { name: 'Loading' }).elements()).toHaveLength(0)
})

test('a lifecycle found without its notification shows as still searching while the search runs', async () => {
  const screen = await renderWithRows([attestedOnly()], true)
  await expect
    .element(screen.getByRole('heading', { name: 'Signature Responded Event' }))
    .toBeVisible()
  const text = screen.container.textContent
  expect(text).not.toContain('no notification')
  expect(text).not.toContain('unknown')
  expect(text).not.toMatch(MISSING_NOTIFICATION)
  // The request time, caller, signature and duration cells, and the two sections.
  expect(screen.getByRole('status', { name: 'Searching' }).elements()).toHaveLength(6)
  expect(screen.getByText('Still searching for event data').elements()).toHaveLength(2)
  expect(
    screen.getByRole('button', { name: 'About the missing notification' }).elements(),
  ).toHaveLength(0)
  expect(screen.container.querySelector('[aria-label="Pending"]')).toBeNull()
})

test('once the search is over the missing notification is a verdict and the signature is pending', async () => {
  const screen = await renderWithRows([attestedOnly()], false)
  await expect
    .element(screen.getByRole('heading', { name: 'Signature Responded Event' }))
    .toBeVisible()
  const text = screen.container.textContent
  expect(text).toContain('no notification')
  expect(text).toContain('unknown')
  expect(text).toMatch(MISSING_NOTIFICATION)
  expect(screen.getByRole('status', { name: 'Searching' }).elements()).toHaveLength(0)
  expect(
    screen.getByRole('button', { name: 'About the missing notification' }).elements(),
  ).toHaveLength(3)
  await expect.element(screen.getByRole('button', { name: 'Pending' })).toBeVisible()
  await expect.element(screen.getByRole('img', { name: 'Pending' })).toBeVisible()
})

test('the filter button opens the filter panel under the header and shows as pressed', async () => {
  const screen = await render(
    <SignBidirectionalLifecycleTable
      lifecycles={[]}
      emptyText="No requests yet"
      expandSoleRow={false}
      searching={false}
      loading={false}
      filterPanel={<p>the filters</p>}
    />,
  )
  const button = screen.getByRole('button', { name: 'Filters' })
  await expect.element(button).toHaveAttribute('aria-pressed', 'false')
  expect(screen.getByText('the filters').elements()).toHaveLength(0)
  await button.click()
  await expect.element(button).toHaveAttribute('aria-pressed', 'true')
  await expect.element(screen.getByText('the filters')).toBeVisible()
  await expect.element(screen.getByText('No requests yet')).toBeVisible()
  await button.click()
  await expect.element(button).toHaveAttribute('aria-pressed', 'false')
  expect(screen.getByText('the filters').elements()).toHaveLength(0)
})
