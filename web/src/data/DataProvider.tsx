import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { stockholmEpoch, store } from '@/lib/format'
import { isFinal, isLive, type Core, type Game } from '@/lib/types'
import { DataContext, dataUrl, type Data } from './context'
import { LIVE_API, LIVE_TEST, liveDue, loadLive } from './live'

type Status = { state: 'loading' } | { state: 'error' } | { state: 'ready'; core: Core }

export function DataProvider({ loading, failed, children }: { loading: ReactNode; failed: ReactNode; children: ReactNode }) {
  const [status, setStatus] = useState<Status>({ state: 'loading' })
  const [games, setGames] = useState<Game[]>([])
  const [fav, setFavState] = useState<string | null>(() => store.get('shlstats-fav'))

  useEffect(() => {
    let off = false
    fetch(dataUrl('core.json'))
      .then((r) => r.json() as Promise<Core>)
      .then((core) => {
        if (off) return
        setGames(core.games.map((g) => (g.id === LIVE_TEST ? { ...g, state: 'live' } : g)))
        setFavState((f) => (f && core.currentTeams.includes(f) ? f : null))
        setStatus({ state: 'ready', core })
      })
      .catch(() => { if (!off) setStatus({ state: 'error' }) })
    return () => { off = true }
  }, [])

  const setFav = useCallback((code: string | null) => {
    setFavState(code || null)
    store.set('shlstats-fav', code || null)
  }, [])

  const core = status.state === 'ready' ? status.core : null
  useLiveScores(core, games, setGames)

  const value = useMemo<Data | null>(() => {
    if (!core) return null
    const teams = core.teams
    return {
      core,
      cur: core.cur,
      prev: core.prev,
      teams,
      codes: core.currentTeams,
      games,
      gamesById: Object.fromEntries(games.map((g) => [g.id, g])),
      headshots: core.headshots || {},
      tName: (c) => teams[c]?.name || c,
      stamp: new Date(core.updated).toLocaleString('sv-SE', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Stockholm' }),
      fav,
      setFav,
    }
  }, [core, games, fav, setFav])

  if (status.state === 'error') return <>{failed}</>
  if (!value) return <>{loading}</>
  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

// Follows games being played through the live relay and merges their state and score into the games list.
// As live as possible: every 6 s while a live game's page is open, every 15 s when games are on, otherwise every 5 min.
function useLiveScores(core: Core | null, games: Game[], setGames: (f: (g: Game[]) => Game[]) => void) {
  const gamesRef = useRef(games)
  useEffect(() => { gamesRef.current = games }, [games])

  useEffect(() => {
    if (!core || !LIVE_API) return
    // Games whose official result is already in the site's data are never overwritten by live data
    const coreFinal = new Set(core.games.filter(isFinal).map((g) => g.id))
    let timer: ReturnType<typeof setTimeout> | undefined, stopped = false

    const tick = async () => {
      clearTimeout(timer)
      const now = gamesRef.current, byId = Object.fromEntries(now.map((g) => [g.id, g]))
      const due = liveDue(now)
      if (due.length && !document.hidden) {
        const patch: Record<string, Partial<Game>> = {}
        const set = (g: Game, p: Partial<Game>) => { patch[g.id] = { ...patch[g.id], ...p } }
        const val = <K extends keyof Game>(g: Game, k: K) => (patch[g.id]?.[k] ?? g[k]) as Game[K]
        try {
          const r = await fetch(`${LIVE_API}/today?season=${core.live.season}&series=${core.live.series}&type=${core.live.type}`)
          const fromFeed: [Game, { hs?: number; as?: number }][] = []
          for (const x of ((await r.json()).games || []) as { id: string; state?: string; ot?: boolean; so?: boolean; hs?: number; as?: number }[]) {
            const g = byId[x.id]
            if (!g || x.id === LIVE_TEST || coreFinal.has(g.id)) continue
            if (x.state === 'pre-game' && g.started) continue // the schedule is behind; the game feed already showed play
            for (const k of ['state', 'ot', 'so'] as const) if (x[k] != null && g[k] !== x[k]) set(g, { [k]: x[k] })
            if (x.state !== 'pre-game') fromFeed.push([g, x])
          }
          // The score of a game under way or just finished comes from its game feed: SHL's schedule sometimes says 0–0
          // for a finished game. The schedule's numbers are only a fallback.
          for (const [g, x] of fromFeed) {
            const L = await loadLive(g.id, 10000)
            const [hs, as] = L && typeof L.hs === 'number' && (L.p || /ended/i.test(String(L.state))) ? [L.hs, L.as] : [x.hs, x.as]
            if (typeof hs === 'number' && typeof as === 'number' && (g.hs !== hs || g.as !== as)) set(g, { hs, as })
          }
        } catch { /* relay unreachable: try again next time */ }
        // SHL's schedule can say "pre-game" for several minutes after face-off. Past the start time, ask the game feed itself.
        for (const g of due) {
          if (val(g, 'state') !== 'pre-game' || g.id === LIVE_TEST || Date.now() < stockholmEpoch(g.start)) continue
          const L = await loadLive(g.id, 0)
          if (L && L.p && !/ended/i.test(String(L.state))) set(g, { state: 'live', started: true, hs: L.hs, as: L.as })
        }
        if (LIVE_TEST && byId[LIVE_TEST]) {
          const g = byId[LIVE_TEST], L = await loadLive(LIVE_TEST, 0)
          if (L && (g.hs !== L.hs || g.as !== L.as)) set(g, { hs: L.hs, as: L.as })
        }
        // An open match page of a game being played: its score follows the game feed
        const open = byId[openMatchId() ?? '']
        if (open && isLive({ ...open, ...patch[open.id] })) {
          const L = await loadLive(open.id, 0)
          if (L && (L.hs !== open.hs || L.as !== open.as)) set(open, { hs: L.hs, as: L.as })
        }
        if (!stopped && Object.keys(patch).length) setGames((gs) => gs.map((g) => (patch[g.id] ? { ...g, ...patch[g.id] } : g)))
      }
      if (stopped) return
      const open = gamesRef.current.find((g) => g.id === openMatchId())
      timer = setTimeout(tick, open && isLive(open) ? 6000 : due.length ? 15000 : 5 * 60e3)
    }
    const onVisible = () => { if (!document.hidden) tick() }
    document.addEventListener('visibilitychange', onVisible)
    tick()
    return () => { stopped = true; clearTimeout(timer); document.removeEventListener('visibilitychange', onVisible) }
  }, [core, setGames])
}

const openMatchId = () => {
  const m = location.hash.match(/^#\/match\/([^/?]+)/)
  return m ? decodeURIComponent(m[1]) : null
}
