import { motion, useReducedMotion } from 'motion/react'
import { useMemo } from 'react'
import { useData } from '@/data/context'
import { oddsTxt, signed } from '@/lib/format'
import { liveTable } from '@/lib/liveTable'
import { rankZone } from '@/lib/stats'
import { TeamBadge } from './TeamBadge'

const shade = (p: number, color = 'var(--accent)') =>
  p <= 0.005 ? undefined : { background: `color-mix(in srgb, ${color} ${Math.round(8 + p * 62)}%, transparent)` }

function Odds({ p, color, className = '' }: { p: number; color?: string; className?: string }) {
  return <td className={`odds ${className}`}><span style={shade(p, color)}>{oddsTxt(p)}</span></td>
}

// The same shaded odds pill, for cells of the sortable tables (stretch: gold odds are small, so their shade is stretched)
export const OddsPill = ({ p, color, stretch = 1 }: { p: number; color?: string; stretch?: number }) =>
  <span className="odds-pill" style={shade(Math.min(1, p * stretch), color)}>{oddsTxt(p)}</span>

// mode: 'full' (all columns), 'stats' (compact, results only) or 'proj' (compact, predictions).
// live (with 'stats'): the table as it stands right now, with games being played counted at their current score. Rows
// glide to their new places as goals go in; a team playing now gets a live dot, its added points and how far it moved.
export function StandingsTable({ mode = 'full', live = false }: { mode?: 'full' | 'stats' | 'proj'; live?: boolean }) {
  const { core, games, tName, fav } = useData()
  const reduced = useReducedMotion()
  const compact = mode !== 'full'
  const now = useMemo(() => (live ? liveTable(core, games) : null), [live, core, games])
  if (now) {
    return (
      <div className="tscroll">
        <table className="t compact live-table" style={{ minWidth: 300 }}>
          <thead>
            <tr><th className="rank">#</th><th className="l">Lag</th><th>SM</th><th>V</th><th className="hide-sm">ÖV</th><th className="hide-sm">ÖF</th><th>F</th><th className="hide-sm">GM–IM</th><th>+/-</th><th>P</th></tr>
          </thead>
          <tbody>
            {now.map((r, i) => {
              const moved = r.was - r.rank, playing = !!r.live
              const cls = [[6, 10, 12].includes(i) && 'cut', r.code === fav && 'fav', playing && 'playing'].filter(Boolean).join(' ')
              return (
                <motion.tr key={r.code} layout={reduced ? false : 'position'} transition={{ type: 'spring', stiffness: 420, damping: 38 }} className={cls || undefined}>
                  <td className="rank" style={{ '--zone': rankZone(r.rank) } as React.CSSProperties}>{r.rank}</td>
                  <td className="l">
                    <a className="teamcell" href={playing ? `#/match/${r.live!.id}` : `#/lag/${r.code}`} title={playing ? `${tName(r.live!.home)} ${r.live!.hs}–${r.live!.as} ${tName(r.live!.away)}` : undefined}>
                      <TeamBadge code={r.code} /><div className="nm"><b>{r.code}</b></div>
                      {playing && <i className="live-dot" aria-label="Spelar nu" />}
                      {moved !== 0 && <span className={`lt-move ${moved > 0 ? 'up' : 'down'}`} aria-label={`${Math.abs(moved)} ${moved > 0 ? 'upp' : 'ner'}`}>{moved > 0 ? '▲' : '▼'}{Math.abs(moved)}</span>}
                    </a>
                  </td>
                  <td>{r.gp}</td><td>{r.w}</td><td className="hide-sm">{r.otw}</td><td className="hide-sm">{r.otl}</td><td>{r.l}</td>
                  <td className="hide-sm">{r.gf}–{r.ga}</td><td>{signed(r.gf - r.ga)}</td>
                  <td><b>{r.pts}</b>{r.dPts > 0 && <small className="lt-plus">+{r.dPts}</small>}</td>
                </motion.tr>
              )
            })}
          </tbody>
        </table>
      </div>
    )
  }
  return (
    <div className="tscroll">
      <table className={`t ${compact ? 'compact' : ''}`} style={{ minWidth: compact ? 300 : 900 }}>
        <thead>
          <tr>
            <th className="rank">#</th><th className="l">Lag</th>
            {mode === 'stats' && <><th>SM</th><th>V</th><th className="hide-sm">ÖV</th><th className="hide-sm">ÖF</th><th>F</th><th className="hide-sm">GM–IM</th><th>+/-</th><th>P</th></>}
            {mode === 'proj' && <><th>P</th><th title="Projicerade poäng">Proj.</th><th className="hide-sm">Topp 6</th><th title="Topp 10">Slutspel</th><th className="hide-sm">SHL-kval</th><th>Guld</th></>}
            {mode === 'full' && <>
              <th>SM</th><th>V</th><th>ÖV</th><th>ÖF</th><th>F</th><th>GM–IM</th><th>P</th><th>Takt<small>52 matcher</small></th><th>Proj.<small>poäng</small></th>
              <th>Topp 6<small>direkt KF</small></th><th>Slutspel<small>topp 10</small></th><th>SHL-kval<small>plats 13–14</small></th><th>SM-guld</th>
            </>}
          </tr>
        </thead>
        <tbody>
          {core.standings.map((r, i) => {
            const s = core.sim[r.code], rank = i + 1, pace = r.gp ? Math.round(r.pts / r.gp * 52) : '–'
            // Gold odds are small numbers, so their shading is stretched 3× to stay visible
            const gold = <td className="odds"><span style={shade(Math.min(1, s.gold * 3), 'var(--gold)')}>{oddsTxt(s.gold)}</span></td>
            const cls = [[6, 10, 12].includes(i) && 'cut', r.code === fav && 'fav'].filter(Boolean).join(' ')
            return (
              <tr key={r.code} className={cls || undefined}>
                <td className="rank" style={{ '--zone': rankZone(rank) } as React.CSSProperties}>{rank}</td>
                <td className="l"><a className="teamcell" href={`#/lag/${r.code}`}><TeamBadge code={r.code} size={compact ? '' : 'md'} /><div className="nm"><b>{compact ? r.code : tName(r.code)}</b></div></a></td>
                {mode === 'stats' && <>
                  <td>{r.gp}</td><td>{r.w}</td><td className="hide-sm">{r.otw}</td><td className="hide-sm">{r.otl}</td><td>{r.l}</td>
                  <td className="hide-sm">{r.gf}–{r.ga}</td><td>{signed(r.gf - r.ga)}</td><td><b>{r.pts}</b></td>
                </>}
                {mode === 'proj' && <>
                  <td><b>{r.pts}</b></td><td>{Math.round(s.proj)}</td><Odds p={s.top6} className="hide-sm" /><Odds p={s.top10} /><Odds p={s.rel} color="var(--bad)" className="hide-sm" />{gold}
                </>}
                {mode === 'full' && <>
                  <td>{r.gp}</td><td>{r.w}</td><td>{r.otw}</td><td>{r.otl}</td><td>{r.l}</td><td>{r.gf}–{r.ga}</td><td><b>{r.pts}</b></td><td>{pace}</td><td><b>{Math.round(s.proj)}</b></td>
                  <Odds p={s.top6} /><Odds p={s.top10} /><Odds p={s.rel} color="var(--bad)" />{gold}
                </>}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export function Legend() {
  return (
    <div className="legend">
      <span><i style={{ background: 'var(--text)' }} />Kvartsfinal (1–6)</span>
      <span><i style={{ background: 'color-mix(in srgb, var(--text) 62%, transparent)' }} />Play in (7–10)</span>
      <span><i style={{ background: 'var(--bad)' }} />SHL-kval (13–14)</span>
    </div>
  )
}
