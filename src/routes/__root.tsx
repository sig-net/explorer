import { Outlet, createRootRoute } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'

import { AppBar } from '@/components/app-bar'
import { AppFooter } from '@/components/app-footer'
import { MidnightProvider } from '@/components/contexts/MidnightContext'
import { MidnightSignetEventsProvider } from '@/components/contexts/MidnightSignetEventsContext'
import { TooltipProvider } from '@/components/ui/tooltip'
import { ThemeProvider } from '@/components/contexts/ThemeContext'

export const Route = createRootRoute({
  component: RootLayout,
  notFoundComponent: NotFound,
})

function RootLayout() {
  return (
    <ThemeProvider>
      <TooltipProvider>
        <MidnightProvider>
          <MidnightSignetEventsProvider>
            <div className="flex h-dvh flex-col">
              <AppBar />
              <Outlet />
              <AppFooter />
            </div>
          </MidnightSignetEventsProvider>
        </MidnightProvider>
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
