// Player model: percentile cards. Every skater is compared with others at the same position (forwards or backs),
// every goalie with other goalies, over this season and last (this season weighted 1.5×).
import { posGroup } from './format'
import { gsaa } from './stats'
import type { Core } from './types'

export interface Metric { k: string; label: string; f: (x: Card) => number }
export interface Card {
  id: string; name: string; team: string; pos: string; grp: 'F' | 'D' | 'G'; num?: number | null; born?: string; nat?: string
  gp: number; vals: Record<string, number>; pct: Record<string, number>; composite: number; impact: number; role?: string
  metrics?: Metric[]; minGp?: number
  [k: string]: unknown
}

type Acc = Card & Record<'g' | 'a' | 'pts' | 'sog' | 'ppg' | 'pm' | 'hits' | 'blk' | 'pim' | 'toiSec' | 'hrs' | 'sv' | 'ga' | 'mins' | 'so' | 'wins' | 'gsaa', number>

export const METRICS: Metric[] = [
  { k: 'p60', label: 'Poäng/60', f: (x) => (x as Acc).pts / (x as Acc).hrs },
  { k: 'g60', label: 'Mål/60', f: (x) => (x as Acc).g / (x as Acc).hrs },
  { k: 'a60', label: 'Assist/60', f: (x) => (x as Acc).a / (x as Acc).hrs },
  { k: 's60', label: 'Skott/60', f: (x) => (x as Acc).sog / (x as Acc).hrs },
  { k: 'fin', label: 'Avslutning', f: (x) => ((x as Acc).g + 0.1 * 25) / ((x as Acc).sog + 25) },
  { k: 'pp', label: 'PP-mål', f: (x) => (x as Acc).ppg / x.gp },
  { k: 'pm', label: 'Plus/minus', f: (x) => (x as Acc).pm / x.gp },
  { k: 'toi', label: 'Istid', f: (x) => (x as Acc).toiSec / x.gp },
  { k: 'hit', label: 'Tacklingar', f: (x) => (x as Acc).hits / x.gp },
  { k: 'blk', label: 'Blockerade skott', f: (x) => (x as Acc).blk / x.gp },
  { k: 'dis', label: 'Disciplin', f: (x) => -(x as Acc).pim / x.gp },
]
const IMPACT_W: Record<'F' | 'D', Record<string, number>> = {
  F: { p60: .30, toi: .20, pm: .15, s60: .10, fin: .05, pp: .05, dis: .05, hit: .05, blk: .05 },
  D: { p60: .20, toi: .25, pm: .20, s60: .05, blk: .10, hit: .05, dis: .05, pp: .05, fin: .05 },
}
export const MIN_GP = 10
// Goalies get their own card: save %, saves above an average goalie, goals against, shutouts, wins and workload
const GK_METRICS: Metric[] = [
  { k: 'svp', label: 'Räddningsprocent', f: (x) => (x as Acc).sv / Math.max(1, (x as Acc).sv + (x as Acc).ga) },
  { k: 'gsaa', label: 'Räddat över snittet', f: (x) => (x as Acc).gsaa / Math.max(1, (x as Acc).mins) * 60 },
  { k: 'gaa', label: 'Få insläppta', f: (x) => -(x as Acc).ga / Math.max(1, (x as Acc).mins) * 60 },
  { k: 'so', label: 'Nollor', f: (x) => (x as Acc).so / Math.max(1, x.gp) },
  { k: 'win', label: 'Vinster', f: (x) => (x as Acc).wins / Math.max(1, x.gp) },
  { k: 'load', label: 'Arbetsbörda', f: (x) => x.gp },
]
const GK_W: Record<string, number> = { svp: .35, gsaa: .30, gaa: .15, so: .08, win: .07, load: .05 }
export const GK_MIN_GP = 5
const SHRINK_GP = 15, GK_SHRINK_GP = 8 // how many average games a small sample is blended with

const pctOf = (sorted: number[], v: number) => {
  let lo = 0, hi = sorted.length
  while (lo < hi) { const mid = (lo + hi) >> 1; if (sorted[mid] < v) lo = mid + 1; else hi = mid }
  let eq = lo
  while (eq < sorted.length && sorted[eq] === v) eq++
  return (lo + (eq - lo) / 2) / Math.max(1, sorted.length)
}
// A few games say little: every value is pulled toward the average regular, as if the player had also played
// k average games. After a full season the player's own numbers dominate; after three games they barely move.
const shrink = (members: Card[], pool: Card[], metrics: Metric[], k: number) => {
  for (const m of metrics) {
    const avg = pool.reduce((t, x) => t + x.vals[m.k], 0) / Math.max(1, pool.length)
    for (const x of members) x.vals[m.k] = (x.vals[m.k] * x.gp + avg * k) / (x.gp + k)
  }
}

const built = new WeakMap<Core, Map<string, Card>>()
export function playerCards(D: Core): Map<string, Card> {
  const have = built.get(D)
  if (have) return have
  const CUR = D.cur, PREV = D.prev, W: Record<string, number> = { [PREV]: 1, [CUR]: 1.5 }
  const players = new Map<string, Acc>()
  for (const season of [PREV, CUR]) for (const p of D.seasons[season]?.skaters || []) {
    if (!p.pos || !p.gp) continue
    const w = W[season]
    const x = players.get(p.id) || ({ id: p.id, name: p.name, born: p.born, nat: p.nat, gp: 0, g: 0, a: 0, pts: 0, sog: 0, ppg: 0, pm: 0, hits: 0, blk: 0, pim: 0, toiSec: 0 } as unknown as Acc)
    x.pos = p.pos; x.grp = posGroup(p.pos) === 'D' ? 'D' : 'F'; x.team = p.team; x.num = p.num
    x.gp += p.gp * w
    for (const k of ['g', 'a', 'pts', 'sog', 'ppg', 'pm', 'hits', 'blk', 'pim'] as const) x[k] += (p[k] || 0) * w
    x.toiSec += p.toi * p.gp * w
    players.set(p.id, x)
  }
  const list = [...players.values()].filter((x) => x.toiSec > 0)
  for (const x of list) { x.hrs = x.toiSec / 3600; x.vals = Object.fromEntries(METRICS.map((m) => [m.k, m.f(x)])) }
  for (const grp of ['F', 'D'] as const) {
    const members = list.filter((x) => x.grp === grp), pool = members.filter((x) => x.gp >= MIN_GP)
    shrink(members, pool, METRICS, SHRINK_GP)
    const sortedBy = Object.fromEntries(METRICS.map((m) => [m.k, pool.map((x) => x.vals[m.k]).sort((a, b) => a - b)]))
    for (const x of members) {
      x.pct = Object.fromEntries(METRICS.map((m) => [m.k, pctOf(sortedBy[m.k], x.vals[m.k])]))
      x.composite = Object.entries(IMPACT_W[grp]).reduce((s, [k, w]) => s + w * x.pct[k], 0)
    }
    const comp = pool.map((x) => x.composite).sort((a, b) => a - b)
    for (const x of members) x.impact = pctOf(comp, x.composite)
  }
  // Role in the team from ice time: 1:a kedjan … / 1:a backpar …
  const byTeam: Record<string, Acc[]> = {}
  for (const x of list) (byTeam[x.team + x.grp] ??= []).push(x)
  for (const arr of Object.values(byTeam)) arr.filter((x) => x.gp >= 3).sort((a, b) => b.toiSec / b.gp - a.toiSec / a.gp).forEach((x, i) => {
    x.role = x.grp === 'F' ? ['1:a kedjan', '2:a kedjan', '3:e kedjan', 'Djupet'][Math.min(3, Math.floor(i / 3))] : ['1:a backpar', '2:a backpar', '3:e backpar'][Math.min(2, Math.floor(i / 2))]
  })
  const CARD = new Map<string, Card>(list.map((x) => [x.id, x]))

  // Goalies, compared with other goalies (same weighting of the two seasons)
  const gks = new Map<string, Acc>()
  for (const season of [PREV, CUR]) for (const g of D.seasons[season]?.goalies || []) {
    if (!g.gpi || !g.mins) continue
    const w = W[season]
    const x = gks.get(g.id) || ({ id: g.id, name: g.name, born: g.born, nat: g.nat, pos: 'GK', grp: 'G', gp: 0, sv: 0, ga: 0, mins: 0, so: 0, wins: 0, gsaa: 0 } as unknown as Acc)
    x.team = g.team; x.num = g.num
    x.gp += g.gpi * w; x.sv += g.sv * w; x.ga += g.ga * w; x.mins += g.mins * w; x.so += g.so * w; x.wins += (g.w_ || 0) * w; x.gsaa += gsaa(g, D.seasons[season]) * w
    gks.set(g.id, x)
  }
  const glist = [...gks.values()]
  for (const x of glist) { x.vals = Object.fromEntries(GK_METRICS.map((m) => [m.k, m.f(x)])); x.metrics = GK_METRICS; x.minGp = GK_MIN_GP }
  const gpool = glist.filter((x) => x.gp >= GK_MIN_GP)
  shrink(glist, gpool, GK_METRICS.filter((m) => m.k !== 'load'), GK_SHRINK_GP) // workload is games played, nothing to pull in
  const gsorted = Object.fromEntries(GK_METRICS.map((m) => [m.k, gpool.map((x) => x.vals[m.k]).sort((a, b) => a - b)]))
  for (const x of glist) {
    x.pct = Object.fromEntries(GK_METRICS.map((m) => [m.k, pctOf(gsorted[m.k], x.vals[m.k])]))
    x.composite = Object.entries(GK_W).reduce((s, [k, w]) => s + w * x.pct[k], 0)
  }
  const gcomp = gpool.map((x) => x.composite).sort((a, b) => a - b)
  for (const x of glist) x.impact = pctOf(gcomp, x.composite)
  const gByTeam: Record<string, Acc[]> = {}
  for (const x of glist) (gByTeam[x.team] ??= []).push(x)
  for (const arr of Object.values(gByTeam)) arr.sort((a, b) => b.mins - a.mins).forEach((x, i) => { x.role = ['Förstemålvakt', 'Andremålvakt', 'Tredjemålvakt'][Math.min(2, i)] })
  for (const x of glist) CARD.set(x.id, x)
  built.set(D, CARD)
  return CARD
}
