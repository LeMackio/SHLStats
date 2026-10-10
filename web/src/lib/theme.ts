import { createContext, useContext } from 'react'

// Two themes: Mörkt (dark) and Ljust (light). With no choice saved, the phone or
// computer's own setting decides. The saved theme is applied before first paint by a small script in index.html.
export const THEMES = ['dark', 'light'] as const
export type ThemeName = (typeof THEMES)[number]
export type ThemeChoice = ThemeName | 'auto'

export interface Theme {
  choice: ThemeChoice // what the user picked
  current: ThemeName // what is showing
  setTheme: (t: ThemeChoice) => void
}

export const ThemeContext = createContext<Theme | null>(null)

// Components that pick colours for contrast (team accents) read this so they redraw after a theme switch
export function useTheme(): Theme {
  const t = useContext(ThemeContext)
  if (!t) throw new Error('useTheme outside <ThemeProvider>')
  return t
}
