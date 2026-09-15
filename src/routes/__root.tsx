import { Outlet, createRootRoute } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'

import { AppBar } from '@/components/app-bar'
import { ThemeProvider } from '@/theme/theme-provider'

export const Route = createRootRoute({
  component: RootLayout,
  notFoundComponent: NotFound,
})

function RootLayout() {
  return (
    <ThemeProvider>
      <div className="flex min-h-screen flex-col">
        <AppBar />
        <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-8">
          <Outlet />
        </main>
      </div>
      <TanStackRouterDevtools position="bottom-right" />
    </ThemeProvider>
  )
}

function NotFound() {
  return (
    <div className="flex flex-1 items-center justify-center">
      <p className="text-muted-foreground">Unknown network.</p>
    </div>
  )
}
