import { normName, sum } from '@/lib/format'
import { isFinal, isLive, type Game, type GameDetails, type GoalEvent, type PlayerRef, type Season } from '@/lib/types'
import { dataUrl } from './context'
import { LIVE_API, loadLive, type LiveData } from './live'

// Finished games' details (goals, box score, videos), fetched once each
const cache: Record<string, GameDetails | null> = {}
export const hasGame = (id: string) => id in cache

export async function loadGame(id: string): Promise<GameDetails | null> {
  if (id in cache) return cache[id]
  try {
    const r = await fetch(dataUrl(`games/${encodeURIComponent(id)}.json`))
    cache[id] = r.ok ? await r.json() : null
  } catch { cache[id] = null }
  return cache[id]
}

// The relay's events in the same shape as a finished game's data, so the pages can show them
export function liveDetails(g: Game, L: LiveData, base: GameDetails | null, season: Season): GameDetails {
  const people = [...season.skaters, ...season.goalies]
  const ref = (name: unknown, side: 'home' | 'away'): PlayerRef | null => {
    if (!name) return null
    const n = normName(String(name)), code = g[side]
    const p = people.find((x) => x.team === code && normName(x.name) === n) || people.find((x) => normName(x.name) === n)
    return { id: p?.id || null, name: String(name) }
  }
  const ev = L.events || [], byTime = (a: { p: number; t: string }, b: { p: number; t: string }) => a.p - b.p || a.t.localeCompare(b.t)
  const goals: GoalEvent[] = ev.filter((e) => e.type === 'goal').map((e) => ({
    p: e.p, t: e.t, team: e.side!, scorer: ref(e.player, e.side!), a1: ref(e.a1, e.side!), a2: ref(e.a2, e.side!),
    str: e.str as string | undefined, en: e.en as boolean | undefined, ps: e.ps as boolean | undefined, score: e.score!,
  })).sort(byTime)
  const pens = ev.filter((e) => e.type === 'penalty').map((e) => ({ p: e.p, t: e.t, team: e.side!, player: ref(e.player, e.side!), desc: e.desc as string, off: e.off })).sort(byTime)
  const sog = (side: string, p?: number) => ev.filter((e) => (e.type === 'shot' || (e.type === 'goal' && !e.en)) && e.side === side && (p == null || e.p === p)).length
  const periods = []
  for (let p = 1; p <= Math.max(L.p || 1, ...goals.map((x) => x.p)); p++) {
    periods.push({ p, h: goals.filter((x) => x.p === p && x.team === 'home').length, a: goals.filter((x) => x.p === p && x.team === 'away').length, hs: sog('home', p), as: sog('away', p) })
  }
  const pim = (side: string) => sum(pens.filter((x) => x.team === side).map((x) => parseInt(x.desc) || 0))
  const team = (side: 'home' | 'away') => ({
    SOG: sog(side), PIM: pim(side), PPG: goals.filter((x) => x.team === side && /^PP/.test(x.str || '')).length,
    NumPP: pens.filter((x) => x.team !== side && /^2/.test(x.desc)).length,
  })
  return {
    ...(base || { box: { home: [], away: [] }, gk: { home: [], away: [] }, shots: [] }),
    id: g.id, home: g.home, away: g.away, hs: L.hs, as: L.as, arena: (L.arena as string) || base?.arena, att: L.att || base?.att,
    goals, pens, periods, team: { home: team('home'), away: team('away') }, live: L,
    shots: ev.filter((e) => e.type === 'shot').map((e) => ({ p: e.p, t: e.t, team: e.side, x: e.x, y: e.y })),
  } as GameDetails
}

// Goals and live state for the finished and live games in a list
export async function detailsFor(games: Game[], season: Season) {
  const out: Record<string, GameDetails | null> = {}
  await Promise.all(games.map(async (g) => {
    if (!isFinal(g) && !isLive(g)) return
    let d = await loadGame(g.id)
    if (isLive(g) && LIVE_API) {
      const L = await loadLive(g.id)
      if (L) d = liveDetails(g, L, d, season)
    }
    out[g.id] = d
  }))
  return out
}
