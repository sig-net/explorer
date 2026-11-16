import type {
  ExplorerNetwork,
  ExplorerService,
  InspectedSignBidirectionalLifecycle,
} from '@sig-net/explorer-api'
import { notificationEvent, responseEvent } from '@sig-net/explorer-lib/testing'
import { createInMemoryExplorerService } from '@sig-net/explorer-api/testing'
import { MIDNIGHT_NETWORKS } from '@sig-net/explorer-lib'
import { bytesToHex, SignetEventName } from '@sig-net/midnight'
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRouter,
} from '@tanstack/react-router'
import { type ReactNode, useEffect } from 'react'
import { expect, test, vi } from 'vitest'
import { render } from 'vitest-browser-react'

import '@/index.css'
import { ExplorerApiProvider } from '@/components/contexts/ExplorerApiContext'
import { MidnightProvider, useMidnight } from '@/components/contexts/MidnightContext'
import { ThemeProvider } from '@/components/contexts/ThemeContext'
import { TooltipProvider } from '@/components/ui/tooltip'
import { DEFAULT_MIDNIGHT_NETWORK, type MidnightNetworkConfig } from '@/lib/midnight/network'
import { inspectedLifecycle } from '@/lib/midnight/inspected-sign-bidirectional-lifecycle.fixture'
import {
  SIGNED_REQUEST,
  SIGNED_REQUEST_ID,
  SIGNED_REQUEST_MPC_RESPONSE,
  SIGNED_REQUEST_MPC_ROOT_KEY,
} from '@/lib/midnight/sign-bidirectional-event.fixture'
import {
  EXECUTED_TRUE_ATTESTATION,
  FIXTURE_MPC_ROOT_KEY,
} from '@/lib/midnight/respond-bidirectional-event.fixture'

import { SignBidirectionalLifecycleTable } from './sign-bidirectional-lifecycle-table'

const REQUEST = new Uint8Array(32).fill(0xaa)
const CALLER = new Uint8Array(32).fill(0x11)

const LOADING_TITLE = 'Loading Sig Network events'
const MISSING_NOTIFICATION =
  /No Sign Bidirectional Event on the configured Signet signer declares this request id/

/** A lifecycle found by its attestation alone, as the newest-first read finds an old request. */
function attestedOnly(): InspectedSignBidirectionalLifecycle {
  return inspectedLifecycle(
    [responseEvent(1, SignetEventName.RespondBidirectionalEvent, REQUEST, 0)],
    { failed: 'not inspected' },
  )
}

/** A lifecycle with its notification, so its row names a caller. */
function notified(): InspectedSignBidirectionalLifecycle {
  return inspectedLifecycle([notificationEvent(1, REQUEST, CALLER, 0)], {
    failed: 'not inspected',
  })
}

/**
 * {@link SIGNED_REQUEST}, notified with `inspection` and answered by the MPC's signature over it.
 */
function signed(
  inspection: Parameters<typeof inspectedLifecycle>[1],
): InspectedSignBidirectionalLifecycle {
  const lifecycle = inspectedLifecycle(
    [
      notificationEvent(1, SIGNED_REQUEST_ID, CALLER, 0),
      responseEvent(2, SignetEventName.SignatureRespondedEvent, SIGNED_REQUEST_ID, 1),
    ],
    inspection,
  )
  return {
    ...lifecycle,
    signatureRespondedEvents: lifecycle.signatureRespondedEvents.map((event) => ({
      ...event,
      record: SIGNED_REQUEST_MPC_RESPONSE,
    })),
  }
}

/** The root key that signed {@link SIGNED_REQUEST} and no EVM node or MPC output cache. */
const SIGNED_REQUEST_CONFIG: MidnightNetworkConfig = {
  mpcRootPublicKey: SIGNED_REQUEST_MPC_ROOT_KEY,
  ethereumMainnetRpcUrl: '',
  ethereumSepoliaRpcUrl: '',
  mpcOutputCacheUrl: '',
}

/**
 * Renders `children` once the selected network's configuration is `config`, so a valid signature
 * asks no node about its transaction unless `config` names one.
 */
function WithConfig({ config, children }: { config: MidnightNetworkConfig; children: ReactNode }) {
  const { config: current, setConfig } = useMidnight()
  const configured =
    current.mpcRootPublicKey === config.mpcRootPublicKey &&
    current.ethereumMainnetRpcUrl === config.ethereumMainnetRpcUrl &&
    current.ethereumSepoliaRpcUrl === config.ethereumSepoliaRpcUrl &&
    current.mpcOutputCacheUrl === config.mpcOutputCacheUrl
  useEffect(() => {
    if (!configured) {
      setConfig(config)
    }
  }, [configured, setConfig, config])
  return configured ? children : null
}

interface RowsOptions {
  readonly onExcludeCaller?: (caller: string) => void
  readonly config?: MidnightNetworkConfig
  readonly service?: ExplorerService | null
}

/** A row's link button builds its href through the router, so rows render inside one. */
function renderWithRows(
  lifecycles: readonly InspectedSignBidirectionalLifecycle[],
  {
    onExcludeCaller = () => undefined,
    config = SIGNED_REQUEST_CONFIG,
    service = null,
  }: RowsOptions = {},
) {
  const routeTree = createRootRoute({
    component: () => (
      <ThemeProvider>
        <ExplorerApiProvider service={service}>
          <MidnightProvider>
            <WithConfig config={config}>
              <TooltipProvider>
                <SignBidirectionalLifecycleTable
                  lifecycles={lifecycles}
                  emptyText="No requests match the search"
                  expandSoleRow
                  loading={false}
                  filterPanel={null}
                  activeFilterCount={0}
                  onExcludeCaller={onExcludeCaller}
                  onLoadMore={null}
                />
              </TooltipProvider>
            </WithConfig>
          </MidnightProvider>
        </ExplorerApiProvider>
      </ThemeProvider>
    ),
  })
  const router = createRouter({ routeTree, history: createMemoryHistory() })
  return render(<RouterProvider router={router} />)
}

test('an empty body shows the load while the events are read, and the empty text once they are', async () => {
  const screen = await render(
    <SignBidirectionalLifecycleTable
      lifecycles={[]}
      emptyText="No requests yet"
      expandSoleRow
      loading
      filterPanel={null}
      activeFilterCount={0}
      onExcludeCaller={() => undefined}
      onLoadMore={null}
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
      loading={false}
      filterPanel={null}
      activeFilterCount={0}
      onExcludeCaller={() => undefined}
      onLoadMore={null}
    />,
  )
  await expect.element(screen.getByText('No requests yet')).toBeVisible()
  expect(screen.getByText(LOADING_TITLE).elements()).toHaveLength(0)
  expect(screen.getByRole('status', { name: 'Loading' }).elements()).toHaveLength(0)
})

test('a lifecycle without its notification shows that as a verdict and the signature as pending', async () => {
  const screen = await renderWithRows([attestedOnly()])
  await expect
    .element(screen.getByRole('heading', { name: 'Signature Responded Event' }))
    .toBeVisible()
  const text = screen.container.textContent
  expect(text).toContain('no notification')
  expect(text).toContain('unknown')
  expect(text).toMatch(MISSING_NOTIFICATION)
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
      loading={false}
      filterPanel={<p>the filters</p>}
      activeFilterCount={0}
      onExcludeCaller={() => undefined}
      onLoadMore={null}
    />,
  )
  const button = screen.getByRole('button', { name: 'Filters' })
  await expect.element(button).toHaveAttribute('aria-pressed', 'false')
  expect(screen.getByText('the filters').elements()).toHaveLength(0)
  await button.hover()
  await expect.element(screen.getByText('Show more filters')).toBeVisible()
  await button.click()
  await expect.element(button).toHaveAttribute('aria-pressed', 'true')
  await expect.element(screen.getByText('the filters')).toBeVisible()
  await expect.element(screen.getByText('No requests yet')).toBeVisible()
  await button.click()
  await expect.element(button).toHaveAttribute('aria-pressed', 'false')
  expect(screen.getByText('the filters').elements()).toHaveLength(0)
})

test('the hide button beside a caller hands that caller over, and says what it does on hover', async () => {
  const onExcludeCaller = vi.fn<(caller: string) => void>()
  const screen = await renderWithRows([notified()], { onExcludeCaller })
  const button = screen.getByRole('button', { name: 'Hide all requests from this caller' })
  await button.hover()
  await expect.element(screen.getByText('Hide all requests from this caller')).toBeVisible()
  await button.click()
  expect(onExcludeCaller).toHaveBeenCalledWith('11'.repeat(32))
})

test('the filter button carries the number of active filters while there are any', async () => {
  const screen = await render(
    <SignBidirectionalLifecycleTable
      lifecycles={[]}
      emptyText="No requests yet"
      expandSoleRow={false}
      loading={false}
      filterPanel={null}
      activeFilterCount={3}
      onExcludeCaller={() => undefined}
      onLoadMore={null}
    />,
  )
  await expect.element(screen.getByText('3active filters')).toBeVisible()
  await screen.getByRole('button', { name: 'Filters' }).hover()
  await expect.element(screen.getByText('3 filters active')).toBeVisible()

  await screen.rerender(
    <SignBidirectionalLifecycleTable
      lifecycles={[]}
      emptyText="No requests yet"
      expandSoleRow={false}
      loading={false}
      filterPanel={null}
      activeFilterCount={0}
      onExcludeCaller={() => undefined}
      onLoadMore={null}
    />,
  )
  expect(screen.getByText('active filters').elements()).toHaveLength(0)
})

test('verifies a signature against the request the lifecycle carries', async () => {
  const screen = await renderWithRows([
    signed({ callChains: [], request: SIGNED_REQUEST, requestCell: null }),
  ])
  await expect.element(screen.getByText('EVM Txn Hash:')).toBeVisible()
  const text = screen.container.textContent
  expect(text).toContain('valid for key0x04...bdd6')
  expect(text).not.toContain('not valid for key')
  expect(text).toContain('EVM Txn Hash:0x84...3f13')
})

test('a failed inspection leaves the signature unverified and says why', async () => {
  const screen = await renderWithRows([signed({ failed: 'the transaction did not deserialise' })])
  await expect
    .element(
      screen.getByText('could not inspect its transaction: the transaction did not deserialise'),
    )
    .toBeVisible()
  expect(screen.container.textContent).not.toContain('valid for key')
})

test("reads the MPC output cache with the server's signer address", async () => {
  const serverSigner = 'cd'.repeat(32)
  const served: ExplorerNetwork[] = MIDNIGHT_NETWORKS.map((network) => ({
    network,
    config: {
      signerContractAddress: serverSigner,
      responderContractAddress: 'ce'.repeat(32),
      startBlock: 0,
      sourceUrl: 'https://indexer.example/api/v4/graphql',
    },
    sync: {
      state: 'synced',
      processedBlock: 1,
      processedBlockTime: null,
      tipBlock: 1,
      lastSuccessAt: null,
      error: null,
    },
  }))
  const service: ExplorerService = {
    ...createInMemoryExplorerService({ networks: [] }),
    networks: () => Promise.resolve(served),
  }
  const requested: string[] = []
  vi.stubGlobal('fetch', (url: string) => {
    requested.push(url)
    return Promise.resolve(new Response(new Uint8Array([1])))
  })
  try {
    const lifecycle = inspectedLifecycle(
      [
        notificationEvent(1, SIGNED_REQUEST_ID, SIGNED_REQUEST.sender.bytes, 0),
        responseEvent(2, SignetEventName.RespondBidirectionalEvent, SIGNED_REQUEST_ID, 1),
      ],
      { callChains: [], request: SIGNED_REQUEST, requestCell: null },
    )
    await renderWithRows(
      [
        {
          ...lifecycle,
          respondBidirectionalEvents: lifecycle.respondBidirectionalEvents.map((event) => ({
            ...event,
            record: EXECUTED_TRUE_ATTESTATION,
          })),
        },
      ],
      {
        config: {
          ...SIGNED_REQUEST_CONFIG,
          mpcRootPublicKey: FIXTURE_MPC_ROOT_KEY,
          mpcOutputCacheUrl: 'https://cache.example/v1/',
        },
        service,
      },
    )
    await expect
      .poll(() => requested)
      .toContain(
        `https://cache.example/v1/${DEFAULT_MIDNIGHT_NETWORK}/${serverSigner}/${bytesToHex(SIGNED_REQUEST_ID)}.bin`,
      )
  } finally {
    vi.unstubAllGlobals()
  }
})
