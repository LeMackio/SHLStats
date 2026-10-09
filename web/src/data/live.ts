import { stockholmEpoch } from '@/lib/format'
import { isFinal, type Game } from '@/lib/types'

// shl.se's API can't be read directly from another website, so live scores come through a small relay
// (live-relay/worker.js, a free Cloudflare Worker). Without it the site shows the score from the latest
// data refresh. Locally the relay can run on port 8787.
export const LIVE_API = location.hostname === 'localhost' ? 'http://localhost:8787' : 'https://shlstats-live.marcuskbroman.workers.dev'

// Local testing only: ?livetest=<game id> shows a finished game as if it were being played
export const LIVE_TEST = location.hostname === 'localhost' ? new URLSearchParams(location.search).get('livetest') : null

export interface LiveEvent {
  type: string
  p: number
  t: string
  side?: 'home' | 'away'
  score?: [number, number]
  [k: string]: unknown
}
export interface LiveData {
  p: number | null
  t?: string
  state?: string
  hs: number
  as: number
  events: LiveEvent[]
  [k: string]: unknown
}

const LIVE: Record<string, { at: number; data: LiveData }> = {} // game id → the relay's latest answer

// Games worth asking about: from 10 minutes before face-off until they must be over
export const liveDue = (games: Game[]) => games.filter((g) => {
  if (g.id === LIVE_TEST) return true
  if (isFinal(g)) return false
  const t = stockholmEpoch(g.start), now = Date.now()
  return now > t - 10 * 60e3 && now < t + 5 * 3600e3
})

export async function loadLive(id: string, maxAge = 15000): Promise<LiveData | null> {
  const c = LIVE[id]
  if (c && Date.now() - c.at < maxAge) return c.data
  try {
    const r = await fetch(`${LIVE_API}/game/${encodeURIComponent(id)}`)
    if (!r.ok) throw new Error(String(r.status))
    const data = await r.json() as LiveData
    // The feed calls the shootout period "shootout"; use 5 like the rest of the site
    const per = (p: unknown) => typeof p === 'number' ? p : /shoot/i.test(String(p)) ? 5 : Number(p) || null
    data.p = per(data.p)
    data.events ??= []
    for (const e of data.events) e.p = per(e.p) || 0
    // The score: never lower than the highest score among the goals (an event entered late can carry an old score)
    const gl = data.events.filter((e) => e.type === 'goal' && Array.isArray(e.score) && typeof e.score[0] === 'number')
    if (gl.length) {
      data.hs = Math.max(data.hs || 0, ...gl.map((e) => e.score![0]))
      data.as = Math.max(data.as || 0, ...gl.map((e) => e.score![1]))
    }
    // The clock: the latest game time among the events (SHL sometimes re-sends an older event last)
    const at = (p: number, t?: string) => p * 1e4 + (([m, s]) => (m || 0) * 60 + (s || 0))(String(t || '0:0').split(':').map(Number))
    for (const e of data.events) if (e.t && e.type !== 'period' && e.p < 5 && at(e.p, e.t) > at(data.p || 0, data.t)) { data.p = e.p; data.t = e.t }
    LIVE[id] = { at: Date.now(), data }
  } catch { /* keep the last answer if there is one */ }
  return LIVE[id]?.data ?? null
}

export const PERIOD_NAME = (p: number) => p === 4 ? 'Förlängning' : p >= 5 ? 'Straffar' : `Period ${p}`
// "Period 2 · 12:34", or a pause between periods
export const liveClock = (L: LiveData | null) => {
  if (!L || !L.p) return 'Pågår'
  const st = String(L.state || '')
  if (/end/i.test(st) && L.t === '20:00' && L.p < 3) return `Paus efter period ${L.p}`
  if (/intermission|break|pause/i.test(st)) return `Paus efter period ${L.p}`
  return `${PERIOD_NAME(L.p)} · ${L.t}`
}
