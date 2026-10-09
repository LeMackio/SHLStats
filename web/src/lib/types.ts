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
  semi: number
  final: number
  rank: number[] // chance of finishing in each place
  qf?: Record<string, number> // likely quarter-final opponents
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
  news?: NewsItem[]
  highlights?: Highlight[]
  recentClips?: GoalClip[]
  lineups: Record<string, Lineup>
  rosters: Record<string, RosterPlayer[]>
  history: Record<string, { played: number; t: Record<string, [number, number, number, number]> }> // per day: [top6, top10, gold, proj]
  seasonOrder: string[]
  pastStandings: Record<string, (Standing & { rank: number })[]>
  pastGames: [string, string, string, string, number, number, number][] // season, date, home, away, hs, as, ot
  [k: string]: unknown
}

export interface NewsItem { id: string; title: string; intro: string; date: string; label?: string; url: string; img?: string }

// A video clip (goal or highlights) on SHL's video host
export interface Clip {
  id?: string
  embed: string
  thumb?: string
  dur?: number
}
export interface Highlight extends Clip { gid: string; date: string; home: string; away: string; hs: number; as: number }
export interface GoalClip extends Clip {
  gid: string; date: string; p: number; t: string; team: string; opp: string; score: [number, number]
  scorer?: { id: string | null; name: string; num?: number }; str?: string; gwg?: number
  xg?: number | null; en?: number // media.json only
}

export interface LineupPlayer { id: string | null; name: string; num?: number | null; pos?: string }
export interface Lineup { F?: Record<string, LineupPlayer[]>; D?: Record<string, LineupPlayer[]>; G?: LineupPlayer[] }
export interface RosterPlayer { id: string; name: string; num?: number | null; pos: string; nat?: string }

// players.json
export interface Bio { name: string; pos: string; team: string; num?: number | null; born?: string; nat?: string; h?: number; w?: number }
export interface PlayersData {
  bios: Record<string, Bio>
  career: Record<string, (string | number)[][]> // [season, team, gp, g, a, pts, pm, pim, sog, toi, ppg]
  goalieCareer: Record<string, (string | number)[][]> // [season, team, gp, sv, ga, svp, gaa, so, w, l, mins]
  gamelogs: Record<string, (string | number)[][]> // [gameId, team, opp, home, g, a, pm, toi, sog, pim, hits, blk] (ids and codes as strings)
  goalieLogs: Record<string, (string | number)[][]> // [gameId, team, opp, home, ga, shots, saves]
  goalClips: Record<string, [string, string, string, string, string, string][]> // [gid, clipId, thumb, embed, date, opp]
}

// teams.json
export interface TeamNews { src: string; date: string; title: string; intro: string; url: string; img?: string }
export interface TeamsData {
  logs: Record<string, (string | number | null)[][]> // [gameId, home, gf, ga, xgf, xga, ppg, ppo, ppga, pko]
  news: Record<string, TeamNews[]>
}

// media.json
export interface MediaData { clips: GoalClip[]; highlights: Highlight[] }

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
