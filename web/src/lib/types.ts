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
  hv?: number // the game has video
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
  num?: number | null
  born?: string
  nat?: string
  rk?: boolean // first SHL season
  gp: number
  g: number
  a: number
  pts: number
  pim: number
  ppg: number
  gwg: number
  sog: number
  hits: number
  blk: number
  pm: number
  toi: number // seconds per game
  [k: string]: unknown
}

export interface Goalie {
  id: string
  name: string
  team: string
  pos: string
  num?: number | null
  born?: string
  nat?: string
  rk?: boolean
  gpi: number
  w_?: number
  l?: number
  sv: number
  ga: number
  svp: number
  gaa: number
  so: number
  mins: number
  [k: string]: unknown
}

export interface Season {
  skaters: Skater[]
  goalies: Goalie[]
}

export interface Standing {
  code: string
  gp: number
  w: number
  otw: number
  otl: number
  l: number
  gf: number
  ga: number
  pts: number
}

// The season simulation for one team
export interface Sim {
  proj: number // projected points after 52 rounds
  lo: number // 80 % range of points
  hi: number
  top6: number
  top10: number
  rel: number // SHL-kval
  gold: number
  rank: number[] // chance of finishing in each place
}

export interface TeamStat {
  gp: number
  sog: number
  sa: number
  ppg: number
  ppo: number
  ppga: number
  pko: number
  fow: number
  fol: number
  hits: number
  pim: number
}

export interface Core {
  updated: string
  cur: string
  prev: string
  teams: Record<string, Team>
  currentTeams: string[]
  games: Game[]
  seasons: Record<string, Season>
  standings: Standing[]
  sim: Record<string, Sim>
  teamStats: Record<string, TeamStat>
  headshots?: Record<string, [string, string]>
  live: { season: string; series: string; type: string }
  [k: string]: unknown
}

// A video clip (goal or highlights) on SHL's video host
export interface Clip {
  embed: string
  thumb?: string
  dur?: number
}

export interface PlayerRef { id: string | null; name: string }

export interface GoalEvent {
  p: number // period (4 = overtime, 5 = shootout)
  t: string // game clock "mm:ss"
  team: 'home' | 'away'
  scorer?: PlayerRef | null
  a1?: PlayerRef | null
  a2?: PlayerRef | null
  score: [number, number]
  str?: string
  en?: boolean
  ps?: boolean
  clip?: Clip
}

// data/games/<id>.json (finished games), or the live relay's data in the same shape
export interface GameDetails {
  id: string
  home: string
  away: string
  hs?: number
  as?: number
  goals: GoalEvent[]
  hl?: Clip | null
  live?: unknown
  [k: string]: unknown
}

export const isFinal = (g: Game) => g.state === 'post-game' && typeof g.hs === 'number'
export const isLive = (g: Game) => g.state !== 'pre-game' && !isFinal(g)
