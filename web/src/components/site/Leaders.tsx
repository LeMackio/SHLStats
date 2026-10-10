import { useEffect, useMemo, useState } from 'react'
import { useData } from '@/data/context'
import { POS_SHORT } from '@/lib/format'
import { readable, teamHue, tColor } from '@/lib/teams'
import { useTheme } from '@/lib/theme'
import { CountUp } from './CountUp'
import { Seg } from './Layout'
import { Empty } from './Panel'
import { Portrait } from './Portrait'
import { SlideIndicator } from './SlideIndicator'
import { PlayerLink, TeamBadge } from './TeamBadge'

export type LeaderRow = { id: string; name: string; team: string; pos: string; num?: number | null }
export interface LeaderStat { k: string; label: string; v: (p: never) => number; tie?: (p: never) => number; asc?: boolean; f?: (x: number) => string }
export interface LeaderSectionDef {
  id: string
  title: string
  note?: string
  rows: LeaderRow[]
  stats: LeaderStat[]
  rowsFor?: (stat: LeaderStat) => LeaderRow[] // some stats only rank part of the rows (Nexus)
}

// A leader section: tabs for each stat, the leader with a full headshot, and the top 10 beside them.
// Hovering (or tapping) a row in the top 10 shows that player in the big card.
export function LeaderSection({ sec, hidden = false }: { sec: LeaderSectionDef; hidden?: boolean }) {
  const { headshots } = useData()
  useTheme() // team colours are picked for contrast with the current theme
  const [statKey, setStatKey] = useState(sec.stats[0].k)
  const [on, setOn] = useState(0)
  const stat = sec.stats.find((s) => s.k === statKey)!
  const fmt = stat.f || ((x: number) => String(x))

  const top = useMemo(() => [...(sec.rowsFor ? sec.rowsFor(stat) : sec.rows)].sort((a, b) =>
    (stat.asc ? stat.v(a as never) - stat.v(b as never) : stat.v(b as never) - stat.v(a as never)) || (stat.tie ? stat.tie(b as never) - stat.tie(a as never) : 0),
  ).slice(0, 10), [sec, stat])
  const shown = top.map((p) => fmt(stat.v(p as never)))
  // Players with the same value share a rank, shown as T7
  const rankOf = (i: number) => shown.indexOf(shown[i]) + 1
  const tied = (i: number) => shown.filter((x) => x === shown[i]).length > 1

  // Load the other headshots in advance so switching player is instant
  useEffect(() => { for (const p of top.slice(1)) if (headshots[p.id]) new Image().src = headshots[p.id][1] }, [top, headshots])

  const sel = top[on] || top[0]
  return (
    <section className="panel lsec" data-sec={sec.id} hidden={hidden}>
      <div className="p-head"><h2>{sec.title}</h2>{sec.note && <span className="stamp">{sec.note}</span>}</div>
      <Seg className="lsec-tabs" id={`lt-${sec.id}`} label={`${sec.title}: statistik`} value={statKey} onChange={(k) => { setStatKey(k); setOn(0) }} options={sec.stats.map((s) => [s.k, s.label])} />
      <div className="p-body" id={`lb-${sec.id}`}>
        {!top.length ? <Empty>Ingen statistik ännu.</Empty> : (
          <div className="lsec-grid">
            <div className="lfeat-slot"><Feature p={sel} label={stat.label} value={shown[on] ?? shown[0]} /></div>
            <ol className="ltop10 has-ind" style={{ '--pill-c': readable(teamHue(sel.team)) } as React.CSSProperties}>
              <SlideIndicator kind="pill" active=".on" groupKey={`ltop10-${sec.id}`} dep={`${on}|${statKey}|${hidden}`} />
              {top.map((p, i) => (
                <li key={p.id} className={i === on ? 'on' : undefined} style={{ '--rc': readable(teamHue(p.team)) } as React.CSSProperties}
                  onMouseOver={() => setOn(i)} onFocus={() => setOn(i)}
                  onClick={(e) => { if (!(e.target as Element).closest('a')) setOn(i) }}>
                  <span className="r num">{tied(i) ? 'T' : ''}{rankOf(i)}.</span>
                  <TeamBadge code={p.team} /><PlayerLink id={p.id} name={p.name} /><b className="num">{shown[i]}</b>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </section>
  )
}

// The big card on the left of a leader section
function Feature({ p, label, value }: { p: LeaderRow; label: string; value: string }) {
  const [first, ...rest] = String(p.name).split(' ')
  return (
    <div className="lfeat" style={{ '--tc': tColor(p.team) } as React.CSSProperties}>
      <Portrait id={p.id} name={p.name} team={p.team} size="feat" />
      <div className="lfeat-info">
        <a className="lfeat-name" href={`#/spelare/${encodeURIComponent(p.id)}`}>{first}<br />{rest.join(' ')}</a>
        <div className="lfeat-meta"><TeamBadge code={p.team} /><span>{p.team} · #{p.num ?? '–'} · {POS_SHORT[p.pos] || 'F'}</span></div>
        <div className="lfeat-lbl">{label}</div>
        <div className="lfeat-val num"><CountUp text={value} dur={450} /></div>
      </div>
    </div>
  )
}
