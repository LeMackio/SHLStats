import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { Seg } from '@/components/site/Layout'
import { Empty } from '@/components/site/Panel'
import { TeamBadge } from '@/components/site/TeamBadge'
import { useData } from '@/data/context'
import { liveClock, PERIOD_NAME, type LiveEvent } from '@/data/live'
import { OFFENCE } from '@/lib/match'
import { pairColors } from '@/lib/teams'
import type { GameDetails } from '@/lib/types'

// Live feed: every shot, block, miss, penalty, goal and goalie change, newest first
const ICON: Record<string, ReactNode> = {
  goal: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 17v-3a5 5 0 0 1 10 0v3" fill="currentColor" fillOpacity=".35" /><path d="M5 17h14v3H5zM12 3v2.5M5.2 6.2l1.6 1.6M18.8 6.2l-1.6 1.6M3 11.5h2M19 11.5h2" /></svg>,
  shot: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3" fill="currentColor" /></svg>,
  miss: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="3 3"><circle cx="12" cy="12" r="8" /></svg>,
  block: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"><path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z" /></svg>,
  penalty: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="13" r="8" /><path d="M12 9v4l2.5 2.5M9 2h6" /></svg>,
  gk: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"><path d="M7 21V11a5 5 0 0 1 10 0v10M4 21h16" /></svg>,
  period: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M5 21V4M5 4h11l-2 4 2 4H5" /></svg>,
  timeout: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M8 5v14M16 5v14" /></svg>,
  so: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="8" /><path d="M12 8v8M8 12h8" /></svg>,
}
const GROUP: Record<string, string> = { goal: 'goal', shot: 'shot', miss: 'shot', block: 'shot', so: 'shot', penalty: 'pen' }
const keyOf = (e: LiveEvent) => e.id != null ? `e${e.id}` : `${e.type}|${e.p}|${e.t}|${e.started ? 1 : 0}${e.finished ? 1 : 0}`
const seenByGame = new Map<string, Set<string>>() // events already shown per game, so only new ones slide in

function feedEvents(d: GameDetails): LiveEvent[] {
  const sec = (e: LiveEvent) => e.type === 'period' ? (e.finished ? 1e5 : -1) : (([m, s]) => (m || 0) * 60 + (s || 0))(String(e.t || '0:0').split(':').map(Number))
  return [...(d.live?.events || [])].sort((a, b) => (b.p || 0) - (a.p || 0) || sec(b) - sec(a) || ((b.id as number) || 0) - ((a.id as number) || 0))
}

// One event on the timeline: the icon sits on the centre line, the home team's events to the left and the
// away team's to the right, with the time on the other side of the icon. Period starts and ends sit on the line.
function FeedRow({ e, d, isNew }: { e: LiveEvent; d: GameDetails; isNew: boolean }) {
  const { tName } = useData()
  const team = e.side ? d[e.side] : null, who = String(e.player || '')
  if (e.type === 'period' || !e.side) {
    const label = e.type === 'period' ? `${PERIOD_NAME(e.p)} ${e.finished ? 'är slut' : 'har börjat'}` : e.type === 'timeout' ? 'Timeout' : e.type
    return <li className={`fd fd-mid fd-${e.type} ${isNew ? 'new' : ''}`}><span className="fd-pill">{ICON[e.type]}{label}</span></li>
  }
  const when = e.p >= 5 ? 'Straff' : `${e.p === 4 ? 'ÖT ' : ''}${String(e.t || '').replace(/^0/, '')}`
  // Main line: usually the player; the line under it says what happened
  let main: ReactNode = who, sub = ''
  switch (e.type) {
    case 'goal': {
      const tag = e.en ? 'Tom kasse' : /^PP/.test(String(e.str || '')) ? 'Powerplay' : /^(SH|BP)/.test(String(e.str || '')) ? 'Boxplay' : e.ps ? 'Straffslag' : ''
      const assists = [e.a1, e.a2].filter(Boolean).join(', ')
      const [h, a] = e.score || []
      main = <>{e.score && <><span className="fd-sc num"><b className={e.side === 'home' ? 'on' : ''}>{h}</b> – <b className={e.side === 'away' ? 'on' : ''}>{a}</b></span> </>}{who || tName(team!)}</>
      sub = [assists ? `Assist: ${assists}` : 'Ingen assist', tag].filter(Boolean).join(' · ')
      break
    }
    case 'shot': sub = 'Skott på mål'; break
    case 'miss': sub = 'Skott utanför'; break
    case 'block': sub = 'Blockerat skott'; break
    case 'penalty': main = who || 'Lagstraff'; sub = [parseInt(String(e.desc)) ? `${parseInt(String(e.desc))} min` : 'Utvisning', OFFENCE[String(e.off)] || String(e.off || '')].filter(Boolean).join(' · '); break
    case 'gk': sub = e.in ? 'Målvakt in' : 'Målvakt ut'; break
    case 'timeout': main = tName(team!); sub = 'Timeout'; break
    case 'so': sub = `Straff · ${e.goal ? 'mål' : 'räddad'}`; break
    default: sub = e.type
  }
  if (!main) { main = sub; sub = '' }
  const txt = <span className="fd-txt"><b>{main}</b>{sub && <small>{sub}</small>}</span>, time = <span className="fd-t num">{when}</span>
  const icon = <span className="fd-ic">{ICON[e.type]}</span>
  return (
    <li className={`fd fd-${e.type} fd-${e.side} ${isNew ? 'new' : ''}`} style={{ '--fc': pairColors(d.home, d.away)[e.side === 'home' ? 0 : 1] } as React.CSSProperties}>
      {e.side === 'home' ? <>{txt}{icon}{time}</> : <>{time}{icon}{txt}</>}
    </li>
  )
}

// Events not seen before slide in (but not on the first draw of a game's feed). They count as new until the
// feed next changes, so other redraws in between keep them marked.
const freshByList = new Map<string, { sig: string; fresh: Set<string> }>()
function freshKeys(gameId: string, listId: string, list: LiveEvent[]) {
  const keys = list.map(keyOf), sig = keys.join(','), id = `${gameId}|${listId}`, last = freshByList.get(id)
  if (last?.sig === sig) return last.fresh
  const seen = seenByGame.get(gameId), fresh = new Set(seen ? keys.filter((k) => !seen.has(k)) : [])
  const all = seen || new Set<string>()
  for (const k of keys) all.add(k)
  seenByGame.set(gameId, all)
  freshByList.set(id, { sig, fresh })
  return fresh
}

function FeedList({ d, list, listId }: { d: GameDetails; list: LiveEvent[]; listId: string }) {
  const { tName } = useData()
  const fresh = freshKeys(d.id, listId, list)
  const isNew = list.map((e) => fresh.has(keyOf(e)))
  if (!list.length) return <Empty>Inget har hänt ännu.</Empty>
  return (
    <>
      <div className="fd-sides"><span><TeamBadge code={d.home} />{tName(d.home)}</span><span>{tName(d.away)}<TeamBadge code={d.away} /></span></div>
      <ol className="fd-list">{list.map((e, i) => <FeedRow key={keyOf(e)} e={e} d={d} isNew={isNew[i]} />)}</ol>
    </>
  )
}

// The card at the top of a live game: the latest events in a fixed-size card; tap it for the full feed
export function FeedCard({ d }: { d: GameDetails }) {
  const [open, setOpen] = useState(false)
  return (
    <section className="panel wide feed-card">
      <div className="feed-open" role="button" tabIndex={0} aria-label="Öppna hela live-flödet"
        onClick={() => setOpen(true)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(true) } }}>
        <div className="p-head"><h2><i className="live-dot" />Live-flöde</h2></div>
        <div className="feed-peek"><FeedList d={d} list={feedEvents(d).slice(0, 8)} listId="peek" /></div>
      </div>
      {open && <FeedDialog d={d} onClose={() => setOpen(false)} />}
    </section>
  )
}

// Full-screen feed, kept up to date while it is open
function FeedDialog({ d, onClose }: { d: GameDetails; onClose: () => void }) {
  const dlg = useRef<HTMLDialogElement>(null), body = useRef<HTMLDivElement>(null)
  const [filter, setFilter] = useState<'all' | 'goal' | 'shot' | 'pen'>('all')
  // Everything already in the feed counts as seen, so only events arriving while it is open slide in
  useState(() => { const s = seenByGame.get(d.id) || new Set<string>(); for (const e of d.live?.events || []) s.add(keyOf(e)); seenByGame.set(d.id, s) })
  useEffect(() => { dlg.current?.showModal() }, [])
  // Every way of closing tells the card directly (a dialog's close event can't be relied on to arrive)
  const close = () => { dlg.current?.close(); onClose() }
  // Live updates redraw the list without moving the scroll position
  const top = useRef(0)
  useLayoutEffect(() => { if (body.current) body.current.scrollTop = top.current })
  const ev = feedEvents(d), cnt = (types: string[], side: string) => ev.filter((e) => types.includes(e.type) && e.side === side).length
  const stat = (label: string, types: string[]) => <div><b className="num">{cnt(types, 'home')}–{cnt(types, 'away')}</b><span>{label}</span></div>
  const shown = ev.filter((e) => filter === 'all' || GROUP[e.type] === filter)
  return (
    <dialog className="feed-dlg" id="feed" ref={dlg} onClose={onClose} onCancel={(e) => { e.preventDefault(); close() }} onClick={(e) => { if (e.target === dlg.current) close() }}>
      <div className="fd-head">
        <button className="fd-close" aria-label="Stäng" onClick={close}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg></button>
        <div className="fd-match">
          <span className="fd-tm"><TeamBadge code={d.home} size="lg" /><small>{d.home}</small></span>
          <span className="fd-scorebox"><b className="num">{d.hs}–{d.as}</b><span className="fd-clock"><i className="live-dot" />{liveClock(d.live ?? null)}</span></span>
          <span className="fd-tm"><TeamBadge code={d.away} size="lg" /><small>{d.away}</small></span>
        </div>
      </div>
      <div className="fd-stats">{stat('Skott på mål', ['shot', 'goal'])}{stat('Utanför', ['miss'])}{stat('Blockerade', ['block'])}{stat('Utvisningar', ['penalty'])}</div>
      <Seg className="fd-filter" id="fd-filter" value={filter} onChange={setFilter} options={[['all', 'Allt'], ['goal', 'Mål'], ['shot', 'Skott'], ['pen', 'Utvisningar']]} />
      <div className="fd-body" ref={body} onScroll={(e) => { top.current = e.currentTarget.scrollTop }}><FeedList d={d} list={shown} listId={`dlg-${filter}`} /></div>
    </dialog>
  )
}
