import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { store } from '@/lib/format'
import { THEMES, ThemeContext, type Theme, type ThemeChoice, type ThemeName } from '@/lib/theme'

const prefersLight = () => matchMedia('(prefers-color-scheme: light)').matches

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [choice, setChoice] = useState<ThemeChoice>(() => {
    const t = document.documentElement.dataset.theme as ThemeName | undefined
    return t && THEMES.includes(t) ? t : 'auto'
  })
  const [systemLight, setSystemLight] = useState(prefersLight)

  useEffect(() => {
    const root = document.documentElement
    if (choice === 'auto') delete root.dataset.theme // e.g. a removed theme still saved in the browser
    else root.dataset.theme = choice
  }, [choice])

  useEffect(() => {
    const mq = matchMedia('(prefers-color-scheme: light)')
    const on = () => setSystemLight(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])

  const setTheme = useCallback((t: ThemeChoice) => {
    setChoice(t)
    store.set('shlstats-theme', t)
  }, [])

  const value = useMemo<Theme>(() => ({
    choice,
    current: choice === 'auto' ? (systemLight ? 'light' : 'dark') : choice,
    setTheme,
  }), [choice, systemLight, setTheme])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
