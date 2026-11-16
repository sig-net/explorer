import type { ExplorerService } from '@sig-net/explorer-api'
import { Outlet, createRootRouteWithContext } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'

import { AppBar } from '@/components/app-bar'
import { AppFooter } from '@/components/app-footer'
import { ExplorerApiProvider } from '@/components/contexts/ExplorerApiContext'
import { MidnightProvider } from '@/components/contexts/MidnightContext'
import { MidnightLifecyclesProvider } from '@/components/contexts/MidnightLifecyclesContext'
import { TooltipProvider } from '@/components/ui/tooltip'
import { ThemeProvider } from '@/components/contexts/ThemeContext'

/** What the router hands every route. */
export interface ExplorerRouterContext {
  /** The explorer's backend, or null when none is configured. */
  readonly explorerService: ExplorerService | null
}

export const Route = createRootRouteWithContext<ExplorerRouterContext>()({
  component: RootLayout,
  notFoundComponent: NotFound,
})

function RootLayout() {
  const { explorerService } = Route.useRouteContext()
  return (
    <ThemeProvider>
      <TooltipProvider>
        <ExplorerApiProvider service={explorerService}>
          <MidnightProvider>
            <MidnightLifecyclesProvider>
              <div className="flex h-dvh flex-col">
                <AppBar />
                <Outlet />
                <AppFooter />
              </div>
            </MidnightLifecyclesProvider>
          </MidnightProvider>
        </ExplorerApiProvider>
      </TooltipProvider>
      <TanStackRouterDevtools position="bottom-right" />
    </ThemeProvider>
  )
}

function NotFound() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-8">
      <p className="text-muted-foreground">Page not found.</p>
    </main>
  )
}
