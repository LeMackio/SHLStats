import { useData } from '@/data/context'
import { liveClock, type LiveData } from '@/data/live'
import { fmtDay, fmtTime, pctTxt } from '@/lib/format'
import { safeEmbed, statusTxt } from '@/lib/game'
import { go } from '@/lib/router'
import { shortName, strengthTag, zoneBad } from '@/lib/stats'
import { isFinal, isLive, type Game, type GameDetails, type GoalEvent } from '@/lib/types'
import { Avatar, TeamBadge } from './TeamBadge'

const rankOf = (standings: { code: string }[], code: string) => standings.findIndex((t) => t.code === code) + 1

// A game as a clickable row: one line per team (logo, name, table position, then the score or the win chance)
// and a link on the right. Inside a day group the date is in the heading.
export function GameRow({ g, dated = false }: { g: Game; dated?: boolean }) {
  const { core, tName, fav } = useData()
  const done = isFinal(g), live = isLive(g), ph = g.ph ?? 0.5
  const team = (c: string, s: 'home' | 'away') => {
    const score = s === 'home' ? g.hs : g.as, other = s === 'home' ? g.as : g.hs, rank = rankOf(core.standings, c)
    return (
      <div className={`gr-t ${done && score! < other! ? 'lose' : ''}`}>
        <TeamBadge code={c} size="md" /><b>{tName(c)}</b>
        {rank ? <span className="gr-rank" title="Tabellplats">{rank}</span> : <span />}
        {done || live
          ? <span className="gr-num num">{score ?? 0}</span>
          : <span className="gr-pct num" title="Vinstchans">{pctTxt(s === 'home' ? ph : 1 - ph)}</span>}
      </div>
    )
  }
  const isFav = fav && (g.home === fav || g.away === fav)
  return (
    <a className={`grow ${isFav ? 'fav' : ''}`} href={`#/match/${g.id}`}>
      <div className="gr-when">
        {dated && <span className="gr-day">{fmtDay(g.start)}</span>}
        {live ? <span className="tag bad">LIVE</span> : done ? <span className="gr-st">{statusTxt(g)}</span> : <span className="gr-time num">{fmtTime(g.start)}</span>}
      </div>
      <div className="gr-teams">{team(g.home, 'home')}{team(g.away, 'away')}</div>
      <div className="gr-end">{done && g.hv ? <span className="vid-dot">Video</span> : null}<span className="chev">›</span></div>
    </a>
  )
}

const PLAY = <svg className="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z" fill="currentColor" /></svg>

// One game as a card (phones): a status chip, a row per team (score, or win chance before the game), then the goals
// as a sideways row (tap one to watch it) or each team's top scorers. Tapping the card opens the match page.
export function GameCard({ g, d }: { g: Game; d?: GameDetails | null }) {
  const { core, cur, tName, fav } = useData()
  const done = isFinal(g), live = isLive(g), isFav = !!fav && (g.home === fav || g.away === fav), ph = g.ph ?? 0.5
  const hs = live && d ? d.hs ?? g.hs : g.hs, as = live && d ? d.as ?? g.as : g.as

  const row = (c: string, s: 'home' | 'away') => {
    const rank = rankOf(core.standings, c), score = s === 'home' ? hs : as, other = s === 'home' ? as : hs
    return (
      <div className={`gc-row ${done && score! < other! ? 'lose' : ''}`}>
        <TeamBadge code={c} size="md" />
        <div className="gc-nm"><b>{tName(c)}</b>{rank > 0 && <span className="gc-rank" title="Tabellplats" style={{ '--zone': zoneBad(rank) } as React.CSSProperties}>{rank}</span>}</div>
        {done || live
          ? <span className="gc-num num">{score ?? 0}</span>
          : <span className="gc-pct num" title="Vinstchans">{pctTxt(s === 'home' ? ph : 1 - ph)}</span>}
      </div>
    )
  }

  const goalChip = (x: GoalEvent, i: number) => {
    const c = x.clip && safeEmbed(x.clip.embed) ? x.clip : null, tag = strengthTag(x)
    const when = x.p >= 5 ? 'Straff' : x.p === 4 ? `ÖT ${x.t}` : `P${x.p} ${x.t}`
    const inner = <>
      <Avatar id={x.scorer?.id} name={x.scorer?.name || '?'} team={g[x.team]} eager />
      <span className="gch-who"><b>{shortName(x.scorer?.name) || 'Mål'}</b><small>{x.score[0]}–{x.score[1]} · {when}{tag ? ` · ${tag}` : ''}</small></span>
      {c && <span className="gch-play">{PLAY}</span>}
    </>
    return c
      ? <button key={i} className="gchip" data-embed={c.embed} data-title={`${x.scorer?.name || 'Mål'} ${x.score[0]}–${x.score[1]}`}>{inner}</button>
      : <div key={i} className="gchip">{inner}</div>
  }

  let mid: React.ReactNode = null
  if (done || live) {
    const goals = d?.goals || []
    mid = goals.length ? <div className="gc-goals">{goals.map(goalChip)}</div>
      : (hs || as) ? <p className="gc-note">Målskyttarna visas efter nästa uppdatering.</p>
      : live ? <p className="gc-note">Inga mål ännu.</p> : null
  } else {
    // Each team's leading goal scorer and assist maker, shown like the goal chips on a played game
    const sk = core.seasons[cur].skaters
    const leadChip = (c: string, k: 'g' | 'a') => {
      const p = sk.filter((x) => x.team === c && x[k] > 0).sort((a, b) => b[k] - a[k] || b.pts - a.pts)[0]
      return p
        ? <a className="gchip" href={`#/spelare/${encodeURIComponent(p.id)}`}><Avatar id={p.id} name={p.name} team={c} eager /><span className="gch-who"><b>{shortName(p.name)}</b><small>{c} · {p[k]} {k === 'g' ? 'mål' : 'assist'}</small></span></a>
        : <div className="gchip empty"><span className="gch-who"><small>{c} · inga {k === 'g' ? 'mål' : 'assist'} än</small></span></div>
    }
    mid = <><div className="gc-lbl">Lagens bästa</div><div className="gc-goals">{leadChip(g.home, 'g')}{leadChip(g.away, 'g')}{leadChip(g.home, 'a')}{leadChip(g.away, 'a')}</div></>
  }

  const hl = done && d?.hl && safeEmbed(d.hl.embed) ? d.hl : null
  const open = () => go(`#/match/${g.id}`)
  return (
    <article className={`gcard ${isFav ? 'fav' : ''} ${live ? 'is-live' : ''}`} tabIndex={0} role="link" aria-label={`${tName(g.home)} mot ${tName(g.away)}`}
      // Opens the match page when tapped anywhere except on a button or link inside it
      onClick={(e) => { if (!(e.target as Element).closest('button, a')) open() }}
      onKeyDown={(e) => { if (e.key === 'Enter' && e.target === e.currentTarget) open() }}>
      <div className="gc-head">
        {done ? <span className="gc-chip">{statusTxt(g)}</span>
          : live ? <span className="gc-chip live"><i className="live-dot" />{liveClock((d?.live as LiveData) ?? null)}</span>
          : <span className="gc-chip">{fmtTime(g.start)}</span>}
        {isFav && <span className="gc-mine" title="Mitt lag" aria-label="Mitt lag">★</span>}
      </div>
      {row(g.home, 'home')}{row(g.away, 'away')}{mid}
      {hl && <div className="gc-foot"><button className="gc-btn" data-embed={hl.embed} data-title={`${g.home}–${g.away} sammandrag`}>{PLAY}Sammandrag</button></div>}
    </article>
  )
}
