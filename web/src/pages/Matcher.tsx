import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Select } from '@/components/arc/select/select'
import filters from '@/components/site/Filters.module.css'
import { GameCard, GameRow } from '@/components/site/Games'
import { PageHead, PageSwitch } from '@/components/site/Layout'
import { Empty, Panel, Skeleton } from '@/components/site/Panel'
import { useData } from '@/data/context'
import { detailsFor, hasGame } from '@/data/games'
import { dateParts, DAYS, fmtDay, MONTHS, store, todayStr } from '@/lib/format'
import { useKeptState } from '@/lib/pageState'
import { go } from '@/lib/router'
import { isFinal, isLive, type Game, type GameDetails } from '@/lib/types'
import { useNarrow } from '@/lib/useNarrow'

export function MatcherPage({ view }: { view: string }) {
  const narrow = useNarrow()
  return narrow ? <DayPage want={view} /> : <GamesList view={['kommande', 'spelade', 'alla'].includes(view) ? view : 'kommande'} />
}

// Computers: the whole regular season's schedule, grouped by day, filtered by team
function GamesList({ view }: { view: string }) {
  const { games, codes, tName, fav } = useData()
  const [team, setTeamState] = useKeptState('games-team', () => (fav && store.get('shlstats-gfilter') === 'fav' ? fav : 'ALL'))
  const setTeam = (t: string) => { setTeamState(t); store.set('shlstats-gfilter', t !== 'ALL' && t === fav ? 'fav' : null) }

  const byDate = useMemo(() => {
    let list = games.filter((g) => team === 'ALL' || g.home === team || g.away === team)
    if (view === 'kommande') list = list.filter((g) => !isFinal(g))
    if (view === 'spelade') list = list.filter(isFinal).reverse()
    const m = new Map<string, Game[]>()
    for (const g of list) { const d = g.start.slice(0, 10); if (!m.has(d)) m.set(d, []); m.get(d)!.push(g) }
    return [...m]
  }, [games, team, view])

  const teamOptions = [{ value: 'ALL', label: 'Alla lag' }, ...[...codes].sort((a, b) => tName(a).localeCompare(tName(b), 'sv')).map((c) => ({ value: c, label: tName(c) }))]
  return (
    <>
      <PageHead title="Matcher & resultat" />
      <PageSwitch base="/matcher" active={view === 'kommande' ? '' : view}
        tabs={[{ key: '', label: 'Kommande' }, { key: 'spelade', label: 'Spelade' }, { key: 'alla', label: 'Alla' }]} />
      <section className="panel">
        <div className="p-body" style={{ paddingTop: 20 }}>
          <div className={filters.filters}><Select label="Lag" value={team} onValueChange={setTeam} options={teamOptions} /></div>
          <div id="glist" style={{ display: 'grid', gap: 16 }}>
            {byDate.length ? byDate.map(([d, gs]) => (
              <div className="day" key={d}><h3>{fmtDay(d)} {dateParts(d).y}</h3>{gs.map((g) => <GameRow key={g.id} g={g} />)}</div>
            )) : <Empty>Inga matcher att visa.</Empty>}
          </div>
        </div>
      </section>
    </>
  )
}

const dayLabel = (d: string) => {
  const diff = Math.round((Date.parse(d) - Date.parse(todayStr())) / 864e5)
  return diff === 0 ? 'Idag' : diff === -1 ? 'Igår' : diff === 1 ? 'I morgon' : null
}
let lastDay: string | null = null, enterFrom = 0 // which side the next day slides in from (1 = from the right)

// Phones: one game day per page with the dates as tabs along the top, the followed team's game first.
// Swipe sideways on the games to change day.
function DayPage({ want }: { want: string }) {
  const { games, core, cur, fav } = useData()
  const days = useMemo(() => [...new Set(games.map((g) => g.start.slice(0, 10)))].sort(), [games])
  // The day Matcher opens on: today if there are games, otherwise the next game day (or the last one after the season)
  const home = useMemo(() => { const t = todayStr(); return days.includes(t) ? t : days.find((d) => d > t) || days[days.length - 1] }, [days])
  let day = /^\d{4}-\d{2}-\d{2}$/.test(want) ? want : home
  if (!days.includes(day)) day = days.find((d) => d >= day) || days[days.length - 1]
  const i = days.indexOf(day), prev = days[i - 1], next = days[i + 1]

  const isFav = (g: Game) => !!fav && (g.home === fav || g.away === fav)
  const dayGames = useMemo(() => games.filter((g) => g.start.startsWith(day))
    .sort((a, b) => Number(isFav(b)) - Number(isFav(a)) || a.start.localeCompare(b.start)), [games, day, fav]) // eslint-disable-line react-hooks/exhaustive-deps

  // Goals for the finished and live games, kept per day: the neighbouring days are fetched ahead, so a swipe lands on
  // a day that is already complete (no loading screen, no goals popping in afterwards). Live games refresh every 15 s.
  const [det, setDet] = useState<Record<string, Record<string, GameDetails | null>>>({})
  const liveSig = dayGames.filter(isLive).map((g) => `${g.id}|${g.hs}|${g.as}|${g.state}`).join(';')
  useEffect(() => {
    let off = false
    const fetchDay = (dd: string) => detailsFor(games.filter((g) => g.start.startsWith(dd)), core.seasons[cur]).then((d) => { if (!off) setDet((m) => ({ ...m, [dd]: d })) })
    fetchDay(day)
    for (const dd of [prev, next]) if (dd) fetchDay(dd)
    return () => { off = true }
  }, [day, liveSig]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!liveSig) return
    const t = setInterval(() => detailsFor(dayGames, core.seasons[cur]).then((d) => setDet((m) => ({ ...m, [day]: d }))), 15000)
    return () => clearInterval(t)
  }, [liveSig]) // eslint-disable-line react-hooks/exhaustive-deps

  // Slide the new day in from the side it came from (a swipe sets the side; a tapped date compares with the last day).
  // Worked out for every day: the page stays mounted while the day changes.
  const enter = useMemo(() => enterFrom || (lastDay && lastDay !== day ? (day > lastDay ? 1 : -1) : 0), [day])
  useEffect(() => { lastDay = day; enterFrom = 0 }, [day])

  const tabs = useRef<HTMLElement>(null)
  useLayoutEffect(() => {
    const t = tabs.current, on = t?.querySelector<HTMLElement>('.on')
    if (t && on) t.scrollLeft = on.offsetLeft - (t.clientWidth - on.offsetWidth) / 2 // centre the chosen day
  }, [day])
  const dayDet = det[day]
  const waiting = !dayDet && dayGames.some((g) => (isFinal(g) || isLive(g)) && !hasGame(g.id))
  const list = useSwipe(prev, next, waiting ? '' : day) // bound when the day's list is on screen

  if (!days.length) return <Panel title="Matcher"><Empty>Inget spelschema ännu.</Empty></Panel>
  return (
    <>
      <nav className="datetabs" id="datetabs" aria-label="Matchdagar" ref={tabs}>
        {days.map((dd) => {
          const p = dateParts(dd), l = dayLabel(dd)
          return (
            <a key={dd} href={`#/matcher/${dd}`} className={[dd === day && 'on', l === 'Idag' && 'today'].filter(Boolean).join(' ') || undefined} aria-current={dd === day ? 'page' : undefined}>
              <b>{DAYS[p.wd][0].toUpperCase() + DAYS[p.wd].slice(1)}</b><span>{p.d} {MONTHS[p.m - 1]}</span>
            </a>
          )
        })}
      </nav>
      {waiting ? <Skeleton /> : (
        <div key={day} className={`daylist ${enter > 0 ? 'in-next' : enter < 0 ? 'in-prev' : ''}`} id="daylist" ref={list}>
          {dayGames.map((g) => <GameCard key={g.id} g={g} d={dayDet?.[g.id]} />)}
        </div>
      )}
      {day !== home && <a className="today-pill" href={`#/matcher/${home}`}>{dayLabel(home) === 'Idag' ? 'Idag' : 'Nästa matchdag'}</a>}
    </>
  )
}

// Swipe sideways on the games to change day: the list follows the finger, slides out, and the next day slides in.
// Bound once per day's list (the list is redrawn for each day), with the neighbouring days read from a ref, so a re-render
// mid-swipe (goals arriving, a live update) never drops the gesture. A quick flick counts as well as a long drag.
function useSwipe(prev: string | undefined, next: string | undefined, day: string) {
  const ref = useRef<HTMLDivElement>(null)
  const sides = useRef({ prev, next })
  sides.current = { prev, next }
  useEffect(() => {
    const list = ref.current
    if (!list) return
    let x0: number | null = null, y0 = 0, t0 = 0, dragging = false
    const reset = () => { list.style.transition = 'transform .22s cubic-bezier(.2, .8, .2, 1), opacity .22s'; list.style.transform = ''; list.style.opacity = '' }
    const start = (e: TouchEvent) => { x0 = (e.target as Element).closest('.gc-goals') ? null : e.touches[0].clientX; y0 = e.touches[0].clientY; t0 = e.timeStamp; dragging = false }
    const move = (e: TouchEvent) => {
      if (x0 == null) return
      const dx = e.touches[0].clientX - x0, dy = e.touches[0].clientY - y0
      if (!dragging) {
        if (Math.abs(dy) > 10 && Math.abs(dy) >= Math.abs(dx)) { x0 = null; return } // scrolling up or down
        if (Math.abs(dx) > 12) dragging = true; else return
      }
      const { prev, next } = sides.current
      const damp = (dx < 0 && !next) || (dx > 0 && !prev) ? 0.25 : 0.9 // resist at the first and last day
      list.style.transition = 'none'
      list.style.transform = `translate3d(${dx * damp}px, 0, 0)`
      list.style.opacity = String(1 - Math.min(0.45, Math.abs(dx) / 700))
    }
    const end = (e: TouchEvent) => {
      if (x0 == null || !dragging) { x0 = null; return }
      const dx = e.changedTouches[0].clientX - x0, to = dx < 0 ? sides.current.next : sides.current.prev
      const flick = Math.abs(dx) > 30 && Math.abs(dx) / Math.max(1, e.timeStamp - t0) > 0.45
      x0 = null; dragging = false
      if ((Math.abs(dx) > 70 || flick) && to) {
        list.style.transition = 'transform .17s ease-in, opacity .17s ease-in'
        list.style.transform = `translate3d(${dx < 0 ? -60 : 60}%, 0, 0)`; list.style.opacity = '0'
        enterFrom = dx < 0 ? 1 : -1
        setTimeout(() => go(`#/matcher/${to}`), 160)
      } else reset()
    }
    const cancel = () => { x0 = null; dragging = false; reset() }
    list.addEventListener('touchstart', start, { passive: true })
    list.addEventListener('touchmove', move, { passive: true })
    list.addEventListener('touchend', end)
    list.addEventListener('touchcancel', cancel)
    return () => {
      list.removeEventListener('touchstart', start)
      list.removeEventListener('touchmove', move)
      list.removeEventListener('touchend', end)
      list.removeEventListener('touchcancel', cancel)
    }
  }, [day])
  return ref
}
