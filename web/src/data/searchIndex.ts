import { useMemo } from 'react'
import { normName } from '@/lib/format'
import { useData } from './context'

export interface Hit { type: 'p' | 't'; id: string; name: string; team: string; pos?: string; key: string; gp: number }

// Players from this season and last, plus the current teams; this season's players rank first
export function useSearchIndex() {
  const { core, cur, prev, codes, tName } = useData()
  return useMemo(() => {
    const out: Hit[] = [], seen = new Set<string>()
    for (const season of [cur, prev]) for (const p of [...core.seasons[season].skaters, ...core.seasons[season].goalies]) {
      if (seen.has(p.id)) continue
      seen.add(p.id)
      out.push({ type: 'p', id: p.id, name: p.name, team: p.team, pos: p.pos, key: normName(p.name), gp: ((p as { gp?: number }).gp || (p as { gpi?: number }).gpi || 0) + (season === cur ? 100 : 0) })
    }
    for (const c of codes) out.push({ type: 't', id: c, name: tName(c), team: c, key: normName(tName(c) + ' ' + c), gp: 1000 })
    return out
  }, [core, cur, prev, codes, tName])
}

// The best 8 matches for what was typed: names starting with it first, then the most games played
export function searchHits(index: Hit[], q: string, filter: (h: Hit) => boolean = () => true) {
  const k = normName(q.trim())
  if (!k) return []
  return index.filter((x) => filter(x) && x.key.includes(k))
    .sort((a, b) => (Number(b.key.startsWith(k)) - Number(a.key.startsWith(k))) || b.gp - a.gp).slice(0, 8)
}
