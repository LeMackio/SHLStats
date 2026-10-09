import { useEffect, useState } from 'react'
import { normName, stockholmEpoch } from '@/lib/format'
import type { Game, Lineup, LineupPlayer, Season } from '@/lib/types'
import { LIVE_API } from './live'

// The clubs' real line-ups for a game, from the relay once they are handed in (game id → home and away)
type Official = { home: Lineup; away: Lineup }
const OFFICIAL: Record<string, Official> = {}
const ORDER: Record<string, number> = { LW: 0, C: 1, CE: 1, RW: 2, LD: 0, RD: 1 }

async function loadOfficial(g: Game, season: Season): Promise<Official | null> {
  if (OFFICIAL[g.id]) return OFFICIAL[g.id]
  if (!LIVE_API) return null
  const t = stockholmEpoch(g.start), now = Date.now()
  if (now < t - 4 * 3600e3 || now > t + 5 * 3600e3) return null // from 4 h before face-off until the game is over
  let r: { ready?: boolean; home: { name: string; num?: number; pos: string; line?: number }[]; away: { name: string; num?: number; pos: string; line?: number }[] }
  try { r = await (await fetch(`${LIVE_API}/lineup/${encodeURIComponent(g.id)}`)).json() } catch { return null }
  if (!r?.ready) return null
  const people = [...season.skaters, ...season.goalies]
  const build = (list: typeof r.home, code: string): Lineup => {
    const F: Record<string, LineupPlayer[]> = {}, D: Record<string, LineupPlayer[]> = {}, G: (LineupPlayer & { line?: number })[] = []
    for (const p of list) {
      const n = normName(p.name), m = people.find((x) => x.team === code && normName(x.name) === n) || people.find((x) => normName(x.name) === n)
      const ref = { id: m?.id || null, name: p.name, num: p.num, pos: p.pos }
      if (p.pos === 'GK') G.push({ ...ref, line: p.line })
      else if (/D$/.test(p.pos)) (D[p.line ?? ''] ??= []).push(ref)
      else (F[p.line ?? ''] ??= []).push(ref)
    }
    for (const grp of [F, D]) for (const k in grp) grp[k].sort((a, b) => (ORDER[a.pos || ''] ?? 1) - (ORDER[b.pos || ''] ?? 1))
    G.sort((a, b) => (a.line ?? 9) - (b.line ?? 9))
    return { F, D, G }
  }
  return (OFFICIAL[g.id] = { home: build(r.home, g.home), away: build(r.away, g.away) }) // kept, so redraws during the game use it straight away
}

// Before face-off (and early in a game whose data has no line-ups yet): the official line-ups once they exist
export function useOfficialLineup(g: Game | undefined, season: Season, enabled: boolean) {
  const [lu, setLu] = useState<Official | null>(() => (g && OFFICIAL[g.id]) || null)
  useEffect(() => {
    if (!g || !enabled || lu) return
    let off = false
    loadOfficial(g, season).then((x) => { if (!off && x) setLu(x) })
    return () => { off = true }
  }, [g, season, enabled, lu])
  return lu
}
