import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useData } from '@/data/context'
import { dateParts, DAYS, MONTHS, todayStr } from '@/lib/format'
import { statusTxt } from '@/lib/game'
import { pillStyle } from '@/lib/teams'
import { isFinal, isLive, type Game } from '@/lib/types'
import { TeamBadge } from './TeamBadge'

// The score strip above the header: every game of the season in one row, opened at today's games
export function Strip() {
  const { games, fav, tName } = useData()
  const track = useRef<HTMLDivElement>(null)
  const anchor = useRef<HTMLDivElement>(null)

  const { dates, byDate, today, anchorDate } = useMemo(() => {
    const byDate = new Map<string, Game[]>()
    for (const g of games) { const d = g.start.slice(0, 10); if (!byDate.has(d)) byDate.set(d, []); byDate.get(d)!.push(g) }
    for (const list of byDate.values()) list.sort((a, b) => a.start.localeCompare(b.start))
    const dates = [...byDate.keys()].sort(), today = todayStr()
    return { dates, byDate, today, anchorDate: dates.find((d) => d >= today) || dates[dates.length - 1] }
  }, [games])

  const toToday = (smooth: boolean) => {
    const t = track.current, a = anchor.current
    if (!t || !a) return
    t.style.scrollBehavior = smooth ? 'smooth' : 'auto'
    t.scrollLeft = Math.max(0, a.offsetLeft - t.offsetLeft - 20)
    t.style.scrollBehavior = ''
  }
  // Opens at today; live score updates later keep the scroll position
  useLayoutEffect(() => toToday(false), [])
  useStripScrolling(track)

  const row = (c: string, right: React.ReactNode, loser = false) => (
    <div className={`s-row${loser ? ' loser' : ''}`}><TeamBadge code={c} /><span className="code">{c}</span>{right}</div>
  )
  const pill = (p: number) => <span className="wp num" style={pillStyle(p)}>{Math.round(p * 100)}%</span>
  const score = (s: number | null | undefined) => <span className="score">{s ?? ''}</span>

  return (
    <div className="strip" aria-label="Matcher">
      <div className="strip-track" id="strip" ref={track}>
        {/* Dates and games are siblings in one flat row, each with a fixed width, so nothing can be squeezed */}
        {dates.flatMap((d) => {
          const p = dateParts(d)
          return [
            <div key={d} className={`s-date ${d === today ? 'today' : ''}`} ref={d === anchorDate ? anchor : undefined}>
              <b>{d === today ? 'idag' : DAYS[p.wd]}</b><span>{p.d}</span><b>{MONTHS[p.m - 1]}</b>
            </div>,
            ...byDate.get(d)!.map((g) => {
              const done = isFinal(g), live = isLive(g), isFav = fav && (g.home === fav || g.away === fav)
              return (
                <a key={g.id} className={`s-game ${isFav ? 'fav' : ''}`} href={`#/match/${g.id}`} draggable={false} title={`${tName(g.home)} – ${tName(g.away)}`}>
                  <div className={`s-status ${live ? 'live' : ''}`}><span>{live ? 'Live' : statusTxt(g)}</span></div>
                  {done || live
                    ? <>{row(g.away, score(g.as), done && g.as! < g.hs!)}{row(g.home, score(g.hs), done && g.hs! < g.as!)}</>
                    : <>{row(g.away, pill(1 - g.ph))}{row(g.home, pill(g.ph))}</>}
                </a>
              )
            }),
          ]
        })}
      </div>
      <div className="strip-ctrl">
        <button className="strip-btn" aria-label="Tidigare matcher" onClick={() => track.current?.scrollBy({ left: -track.current.clientWidth * 0.8 })}>‹</button>
        <button className="strip-today" title="Hoppa till dagens matcher" onClick={() => toToday(true)}>Idag</button>
        <button className="strip-btn" aria-label="Senare matcher" onClick={() => track.current?.scrollBy({ left: track.current.clientWidth * 0.8 })}>›</button>
      </div>
    </div>
  )
}

// Mouse wheel scrolls sideways, click-and-drag pans
function useStripScrolling(ref: React.RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const track = ref.current
    if (!track) return
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) { track.style.scrollBehavior = 'auto'; track.scrollLeft += e.deltaY; track.style.scrollBehavior = ''; e.preventDefault() }
    }
    let startX = 0, startLeft = 0, down = false, moved = false
    const onDown = (e: PointerEvent) => { if (e.pointerType !== 'mouse') return; down = true; moved = false; startX = e.clientX; startLeft = track.scrollLeft }
    const onMove = (e: PointerEvent) => {
      if (!down) return
      const dx = e.clientX - startX
      if (Math.abs(dx) > 5) { moved = true; track.classList.add('dragging') }
      if (moved) track.scrollLeft = startLeft - dx
    }
    const onUp = () => { down = false; setTimeout(() => track.classList.remove('dragging'), 0) }
    const onClick = (e: MouseEvent) => { if (moved) { e.preventDefault(); moved = false } }
    track.addEventListener('wheel', onWheel, { passive: false })
    track.addEventListener('pointerdown', onDown)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    track.addEventListener('click', onClick, true)
    return () => {
      track.removeEventListener('wheel', onWheel)
      track.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      track.removeEventListener('click', onClick, true)
    }
  }, [ref])
}
