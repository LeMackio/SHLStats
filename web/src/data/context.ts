import { createContext, useContext } from 'react'
import type { Core, Game, Team } from '@/lib/types'

// Data URLs carry the build version so an update is never mixed with old cached data
export const dataUrl = (path: string) => `data/${path}?v=${__BUILD__}`

export interface Data {
  core: Core
  cur: string
  prev: string
  teams: Record<string, Team>
  codes: string[] // the current season's teams
  games: Game[] // with live scores merged in
  gamesById: Record<string, Game>
  headshots: Record<string, [string, string]>
  tName: (code: string) => string
  stamp: string // "Uppdaterad …" time of the data
  fav: string | null
  setFav: (code: string | null) => void
}

export const DataContext = createContext<Data | null>(null)

export function useData(): Data {
  const d = useContext(DataContext)
  if (!d) throw new Error('useData outside <DataProvider>')
  return d
}
