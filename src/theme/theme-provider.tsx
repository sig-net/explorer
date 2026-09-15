import { type ReactNode, useEffect, useState } from 'react'

import { type Theme, ThemeContext, type ThemeContextValue } from './theme-context'

const STORAGE_KEY = 'explorer-theme'

function readStoredTheme(): Theme | null {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    return stored === 'light' || stored === 'dark' ? stored : null
  } catch {
    return null
  }
}

function systemTheme(): Theme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => readStoredTheme() ?? systemTheme())

  useEffect(() => {
    const root = window.document.documentElement
    root.classList.remove('light', 'dark')
    root.classList.add(theme)
  }, [theme])

  const value: ThemeContextValue = {
    theme,
    setTheme: (next: Theme) => {
      try {
        window.localStorage.setItem(STORAGE_KEY, next)
      } catch {
        // Storage can be unavailable (private mode, blocked site data). The theme still applies.
      }
      setThemeState(next)
    },
  }

  return <ThemeContext value={value}>{children}</ThemeContext>
}
