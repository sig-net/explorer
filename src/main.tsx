import { RouterProvider, createRouter } from '@tanstack/react-router'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import './index.css'
import { routeTree } from './routeTree.gen'

// The base path Vite builds for: `/` at a domain root, `/explorer/` on GitHub Pages.
const router = createRouter({ routeTree, basepath: import.meta.env.BASE_URL })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
