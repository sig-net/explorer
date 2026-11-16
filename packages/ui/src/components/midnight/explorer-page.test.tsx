import {
  ExplorerApiError,
  type ExplorerService,
  type LifecyclePage,
  type LifecyclesQuery,
} from '@sig-net/explorer-api'
import {
  createInMemoryExplorerService,
  EXPLORER_SEED_CASES,
  explorerSeed,
} from '@sig-net/explorer-api/testing'
import { MidnightNetwork } from '@sig-net/midnight'
import { RouterProvider, createMemoryHistory, createRouter } from '@tanstack/react-router'
import { expect, test, vi } from 'vitest'
import { userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'

import '@/index.css'
import { truncateMiddle } from '@/lib/format'
import { routeTree } from '@/routeTree.gen'

const EXPLORER_URL = '/midnight/explorer?networkId=preprod'

/** The seed's preprod request ids, newest first. */
const NEWEST_FIRST = [
  EXPLORER_SEED_CASES.notInspectedRequestId,
  EXPLORER_SEED_CASES.attestationWithoutRequestId,
  EXPLORER_SEED_CASES.failedInspectionRequestId,
  EXPLORER_SEED_CASES.notifiedTwiceRequestId,
  EXPLORER_SEED_CASES.responseWithoutRequestId,
  EXPLORER_SEED_CASES.completeRequestId,
]

/** The seed's in-memory service, its `lifecycles` recorded, its pages `limit` long when given. */
function seededService(limit?: number) {
  const inner = createInMemoryExplorerService(explorerSeed)
  let failure: ExplorerApiError | null = null
  const lifecycles = vi.fn<ExplorerService['lifecycles']>(
    (network: MidnightNetwork, query?: LifecyclesQuery): Promise<LifecyclePage> => {
      if (failure !== null) {
        return Promise.reject(failure)
      }
      return inner.lifecycles(network, limit === undefined ? query : { ...query, limit })
    },
  )
  const service: ExplorerService = { ...inner, lifecycles }
  return {
    service,
    lifecycles,
    /** Every later `lifecycles` call rejects with `error`. */
    failWith: (error: ExplorerApiError) => {
      failure = error
    },
  }
}

async function renderExplorer(service: ExplorerService | null, url: string = EXPLORER_URL) {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [url] }),
    context: { explorerService: service },
  })
  // Loads the route's lazily split component before the first render.
  await router.load()
  const screen = await render(<RouterProvider router={router} />)
  return { screen, router }
}

/** The request ids the table's rows show, truncated as the rows show them, top to bottom. */
function shownRequestIds(): string[] {
  return [...document.querySelectorAll('tbody tr > td:nth-child(3) .font-mono')].map(
    (cell) => cell.textContent,
  )
}

function truncated(requestIds: readonly string[]): string[] {
  return requestIds.map((requestId) => truncateMiddle(requestId))
}

/** The calls of `lifecycles` for the preprod network, by their query. */
function preprodQueries(lifecycles: ReturnType<typeof seededService>['lifecycles']) {
  return lifecycles.mock.calls
    .filter(([network]) => network === MidnightNetwork.Preprod)
    .map(([, query]) => query ?? {})
}

test('lists the newest lifecycles of the selected network', async () => {
  await renderExplorer(seededService().service)
  await expect.poll(shownRequestIds).toEqual(truncated(NEWEST_FIRST))
})

test('load more appends the next page once', async () => {
  const { service, lifecycles } = seededService(2)
  const { screen } = await renderExplorer(service)
  await expect.poll(shownRequestIds).toEqual(truncated(NEWEST_FIRST.slice(0, 2)))
  await screen.getByRole('button', { name: 'Load more' }).click()
  await expect.poll(shownRequestIds).toEqual(truncated(NEWEST_FIRST.slice(0, 4)))
  expect(preprodQueries(lifecycles).filter((query) => query.before !== undefined)).toHaveLength(1)
  await screen.getByRole('button', { name: 'Load more' }).click()
  await expect.poll(shownRequestIds).toEqual(truncated(NEWEST_FIRST))
  expect(screen.getByRole('button', { name: 'Load more' }).elements()).toHaveLength(0)
})

test('a search asks the service and resets the pages', async () => {
  const { service, lifecycles } = seededService(2)
  const { screen } = await renderExplorer(service)
  await screen.getByRole('button', { name: 'Load more' }).click()
  await expect.poll(shownRequestIds).toEqual(truncated(NEWEST_FIRST.slice(0, 4)))
  await screen
    .getByRole('textbox', { name: 'Search by request id or caller contract' })
    .fill('0xD3D3')
  await expect
    .poll(shownRequestIds)
    .toEqual(truncated([EXPLORER_SEED_CASES.failedInspectionRequestId]))
  expect(preprodQueries(lifecycles).at(-1)).toEqual({ search: '0xD3D3', excludeCallers: [] })
  expect(screen.getByRole('button', { name: 'Load more' }).elements()).toHaveLength(0)
})

test('a search shorter than three characters says so', async () => {
  const { screen } = await renderExplorer(seededService().service)
  const box = screen.getByRole('textbox', { name: 'Search by request id or caller contract' })
  await box.fill('d3')
  await expect.element(screen.getByText('Type at least 3 characters to search')).toBeVisible()
  await expect.poll(shownRequestIds).toEqual(truncated(NEWEST_FIRST))
  await box.fill('d3d')
  await expect
    .poll(shownRequestIds)
    .toEqual(truncated([EXPLORER_SEED_CASES.failedInspectionRequestId]))
  expect(screen.getByText('Type at least 3 characters to search').elements()).toHaveLength(0)
})

test('shows the matching and total counts of the service', async () => {
  const reference = createInMemoryExplorerService(explorerSeed)
  const all = await reference.lifecycles(MidnightNetwork.Preprod)
  const searched = await reference.lifecycles(MidnightNetwork.Preprod, { search: 'c2c2' })
  const { screen } = await renderExplorer(seededService().service)
  await expect
    .element(
      screen.getByText(
        `${String(all.matchingEvents)}/${String(all.totalEvents)} events, ` +
          `${String(all.matchingRequests)}/${String(all.totalRequests)} requests`,
        { exact: true },
      ),
    )
    .toBeVisible()
  await screen
    .getByRole('textbox', { name: 'Search by request id or caller contract' })
    .fill('c2c2')
  await expect
    .element(
      screen.getByText(
        `${String(searched.matchingEvents)}/${String(searched.totalEvents)} events, ` +
          `${String(searched.matchingRequests)}/${String(searched.totalRequests)} requests`,
        { exact: true },
      ),
    )
    .toBeVisible()
  expect(searched.matchingRequests).toBe(1)
})

test('excluding a caller asks the service and keeps the URL in step', async () => {
  const { service, lifecycles } = seededService()
  const { screen, router } = await renderExplorer(service)
  await expect.poll(shownRequestIds).toEqual(truncated(NEWEST_FIRST))
  const caller = EXPLORER_SEED_CASES.failedInspectionCaller
  await screen.getByRole('button', { name: 'Filters' }).click()
  await screen.getByRole('combobox', { name: 'Exclude callers' }).fill(caller)
  await userEvent.keyboard('{Escape}')
  await screen.getByRole('button', { name: 'Exclude the typed caller' }).click()
  await expect
    .poll(shownRequestIds)
    .toEqual(
      truncated(
        NEWEST_FIRST.filter(
          (requestId) => requestId !== EXPLORER_SEED_CASES.failedInspectionRequestId,
        ),
      ),
    )
  expect(new URLSearchParams(router.state.location.searchStr).get('excludeCallers')).toBe(caller)
  expect(preprodQueries(lifecycles).at(-1)).toEqual({ search: '', excludeCallers: [caller] })

  await screen.getByRole('button', { name: `Stop excluding ${caller}` }).click()
  await expect.poll(shownRequestIds).toEqual(truncated(NEWEST_FIRST))
  expect(new URLSearchParams(router.state.location.searchStr).has('excludeCallers')).toBe(false)
})

test('a linked request id shows that request alone', async () => {
  const requestId = EXPLORER_SEED_CASES.notifiedTwiceRequestId
  const { screen } = await renderExplorer(
    seededService().service,
    `${EXPLORER_URL}&requestId=${requestId}`,
  )
  await expect.poll(shownRequestIds).toEqual(truncated([requestId]))
  await expect
    .element(screen.getByRole('textbox', { name: 'Search by request id or caller contract' }))
    .toHaveValue(requestId)
})

test('a linked request id that is unknown says so', async () => {
  const { screen } = await renderExplorer(
    seededService().service,
    `${EXPLORER_URL}&requestId=${'ab'.repeat(32)}`,
  )
  await expect.element(screen.getByText('Request not found')).toBeVisible()
  expect(shownRequestIds()).toEqual([])
})

test('refresh reads the first page again', async () => {
  const { service, lifecycles } = seededService(2)
  const { screen } = await renderExplorer(service)
  await screen.getByRole('button', { name: 'Load more' }).click()
  await expect.poll(shownRequestIds).toEqual(truncated(NEWEST_FIRST.slice(0, 4)))
  const firstPageReads = (): number =>
    preprodQueries(lifecycles).filter((query) => query.before === undefined).length
  const before = firstPageReads()
  await screen.getByRole('button', { name: 'Refresh' }).click()
  await expect.poll(shownRequestIds).toEqual(truncated(NEWEST_FIRST.slice(0, 2)))
  expect(firstPageReads()).toBe(before + 1)
})

test('a failing service shows the error and keeps what was loaded', async () => {
  const { service, failWith } = seededService(2)
  const { screen } = await renderExplorer(service)
  await expect.poll(shownRequestIds).toEqual(truncated(NEWEST_FIRST.slice(0, 2)))
  failWith(new ExplorerApiError('unavailable', 'the explorer API did not answer: test outage'))
  await screen.getByRole('button', { name: 'Load more' }).click()
  await expect
    .element(screen.getByText('the explorer API did not answer: test outage'))
    .toBeVisible()
  expect(shownRequestIds()).toEqual(truncated(NEWEST_FIRST.slice(0, 2)))
})

test('without a backend URL the page says none is configured', async () => {
  const { screen } = await renderExplorer(null)
  await expect.element(screen.getByText('No explorer backend configured')).toBeVisible()
  expect(screen.getByRole('table').elements()).toHaveLength(0)
})
