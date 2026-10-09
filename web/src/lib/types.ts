// Shapes of the data files built by ../fetch-data.mjs. Only the fields the app reads are typed;
// the rest stays open until the pages that use them are ported.

export type GameState = 'pre-game' | 'live' | 'post-game' | string

export interface Game {
  id: string
  start: string // "YYYY-MM-DD HH:MM:SS", Stockholm time
  state: GameState
  home: string
  away: string
  hs?: number | null
  as?: number | null
  ot?: boolean
  so?: boolean
  ph: number // home win probability before the game
  arena?: string
  started?: boolean
  [k: string]: unknown
}

export interface Team {
  code: string
  name: string
  logo?: string
}

export interface Skater {
  id: string
  name: string
  team: string
  pos: string
  gp?: number
  [k: string]: unknown
}

export interface Goalie {
  id: string
  name: string
  team: string
  pos: string
  gpi?: number
  [k: string]: unknown
}

export interface Season {
  skaters: Skater[]
  goalies: Goalie[]
}

export interface Core {
  updated: string
  cur: string
  prev: string
  teams: Record<string, Team>
  currentTeams: string[]
  games: Game[]
  seasons: Record<string, Season>
  headshots?: Record<string, [string, string]>
  live: { season: string; series: string; type: string }
  [k: string]: unknown
}

export const isFinal = (g: Game) => g.state === 'post-game' && typeof g.hs === 'number'
export const isLive = (g: Game) => g.state !== 'pre-game' && !isFinal(g)
