import { Outlet, createRootRoute } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'

import { AppBar } from '@/components/app-bar'
import { MidnightProvider } from '@/components/contexts/MidnightContext'
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
          <div className="flex min-h-screen flex-col">
            <AppBar />
            <Outlet />
          </div>
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
