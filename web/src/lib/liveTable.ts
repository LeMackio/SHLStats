import { isFinal, isLive, type Core, type Game, type Standing } from './types'

export interface LiveStanding extends Standing {
  rank: number // place right now
  was: number // place in the official table from the latest data refresh
  dPts: number // points added since then (games finished since, and games being played at their current score)
  live?: Game // the team's game being played right now
}

// The table as it stands right now. Games finished since the latest data refresh count in full; games being played
// count at their current score, as if they ended now: the leader gets 3 points (2 and 1 once in overtime), a tie gives
// both teams 1 (the extra point is decided in overtime). Ties in points are split like SHL: goal difference, then goals.
export function liveTable(core: Core, games: Game[]): LiveStanding[] {
  const counted = new Set(core.games.filter(isFinal).map((g) => g.id))
  const rows = core.standings.map((r, i) => ({ ...r, rank: i + 1, was: i + 1, dPts: 0 } as LiveStanding))
  const by = Object.fromEntries(rows.map((r) => [r.code, r]))
  for (const g of games) {
    if (counted.has(g.id)) continue // already in the official table
    const fresh = isFinal(g), live = isLive(g) && typeof g.hs === 'number' && typeof g.as === 'number'
    if (!fresh && !live) continue
    const H = by[g.home], A = by[g.away], hs = g.hs as number, as = g.as as number
    if (!H || !A) continue
    const extra = !!(g.ot || g.so)
    for (const [T, f, a] of [[H, hs, as], [A, as, hs]] as const) {
      T.gp++; T.gf += f; T.ga += a
      const pts = f > a ? (extra ? 2 : 3) : f < a ? (extra ? 1 : 0) : 1 // a game in overtime already has its extra flag
      if (fresh) { if (f > a) { if (extra) T.otw++; else T.w++ } else if (extra) T.otl++; else T.l++ }
      T.pts += pts; T.dPts += pts
      if (live) T.live = g
    }
  }
  rows.sort((x, y) => y.pts - x.pts || (y.gf - y.ga) - (x.gf - x.ga) || y.gf - x.gf || x.was - y.was)
  rows.forEach((r, i) => { r.rank = i + 1 })
  return rows
}
