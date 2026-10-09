import { useState } from 'react'
import { Empty } from '@/components/site/Panel'
import { useData } from '@/data/context'
import { dec, pctTxt, sum } from '@/lib/format'
import { TC, tColor } from '@/lib/teams'
import type { Goalie, Season, Standing } from '@/lib/types'
import { gsaa } from '@/lib/stats'
import { useChartWidth, useNarrow } from '@/lib/useNarrow'

// Team label on the left of a chart row: the name (code on phones) and the logo
function RowLabel({ code, left, y }: { code: string; left: number; y: number }) {
  const { teams, tName, fav } = useData()
  const narrow = useNarrow()
  return (
    <>
      <text x={left - 32} y={y + 4.5} textAnchor="end" fontSize="13.5" style={{ fill: 'var(--text)', fontWeight: code === fav ? 700 : 500 }}>{narrow ? code : tName(code)}</text>
      {teams[code]?.logo && <image href={teams[code].logo} x={left - 26} y={y - 10} width="20" height="20" />}
    </>
  )
}

// Poängprognos: projected points after 52 rounds, the bar the middle 80 % of outcomes and the dot the average
export function PointsRange({ rows }: { rows: Standing[] }) {
  const { core, tName } = useData()
  const narrow = useNarrow(), W = useChartWidth(640)
  const rowH = narrow ? 30 : 26, left = narrow ? 84 : 150, right = narrow ? 6 : 20, top = 22, H = top + rows.length * rowH + 6
  const S = core.sim
  const lo = Math.min(...rows.map((r) => S[r.code].lo)), hi = Math.max(...rows.map((r) => S[r.code].hi))
  const minX = Math.floor(lo / 10) * 10, maxX = Math.ceil(hi / 10) * 10, step = narrow && maxX - minX > 60 ? 20 : 10
  const x = (v: number) => left + (v - minX) / (maxX - minX || 1) * (W - left - right)
  const ticks = []
  for (let t = minX; t <= maxX; t += step) ticks.push(t)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Poängprognos">
      {ticks.map((t) => (
        <g key={t}>
          <line x1={x(t)} x2={x(t)} y1={top - 4} y2={top + rows.length * rowH} style={{ stroke: 'var(--line)' }} />
          <text x={x(t)} y={top - 8} textAnchor="middle" fontSize="11" style={{ fill: 'var(--faint)' }}>{t}</text>
        </g>
      ))}
      {rows.map((r, i) => {
        const s = S[r.code], y = top + i * rowH + rowH / 2
        return (
          <g key={r.code}>
            <RowLabel code={r.code} left={left} y={y} />
            <line x1={x(s.lo)} x2={x(s.hi)} y1={y} y2={y} style={{ stroke: `color-mix(in srgb, ${tColor(r.code)} 70%, var(--accent))` }} strokeWidth="8" strokeLinecap="round" opacity=".55" />
            <circle cx={x(s.proj)} cy={y} r="6" style={{ fill: 'var(--text)' }}><title>{`${tName(r.code)}: ${dec(s.proj, 0)} poäng (${s.lo}–${s.hi})`}</title></circle>
          </g>
        )
      })}
    </svg>
  )
}

// Slutplacering: the chance of finishing in each place, one cell per position, all 14 visible without scrolling
export function FinalPlacing({ rows }: { rows: Standing[] }) {
  const { core, codes, tName } = useData()
  const narrow = useNarrow(), W = useChartWidth(640)
  const rowH = narrow ? 30 : 26, left = narrow ? 84 : 150, right = narrow ? 6 : 20, top = 22, H = top + rows.length * rowH + 6
  const n = codes.length, cell = (W - left - right) / n
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Slutplacering">
      {Array.from({ length: n }, (_, k) => (
        <text key={k} x={left + k * cell + cell / 2} y={top - 8} textAnchor="middle" fontSize="11" style={{ fill: 'var(--faint)' }}>{k + 1}</text>
      ))}
      {rows.map((r, i) => {
        const y = top + i * rowH + rowH / 2
        return (
          <g key={r.code}>
            <RowLabel code={r.code} left={left} y={y} />
            {core.sim[r.code].rank.map((p, k) => {
              const c = k < 6 ? 'var(--accent)' : k < 10 ? 'color-mix(in srgb, var(--accent) 55%, var(--faint))' : k >= 12 ? 'var(--bad)' : 'var(--faint)', x0 = left + k * cell
              return (
                <g key={k}>
                  <rect x={x0 + 1} y={y - rowH / 2 + 2} width={cell - 2} height={rowH - 4} rx="3" style={{ fill: c, fillOpacity: p < 0.005 ? 0.05 : Math.min(0.9, 0.14 + p * 1.6) }}>
                    <title>{`${tName(r.code)} slutar ${k + 1}:a: ${pctTxt(p, 1)}`}</title>
                  </rect>
                  {p >= 0.05 && <text x={x0 + cell / 2} y={y + 4} textAnchor="middle" fontSize={narrow ? 11 : 12} fontWeight="600" style={{ fill: 'var(--text)' }}>{Math.round(p * 100)}</text>}
                </g>
              )
            })}
          </g>
        )
      })}
    </svg>
  )
}

export interface ScatterRow { code: string; name: string; x: number | null; y: number | null }

// Attack (x) against defence (y) per team. Fewer goals conceded plots higher, so the best teams sit top right.
// Defaults to goals per game; the Nexus page passes expected goals.
export function TeamScatter({ rows, xLabel = 'Gjorda mål per match', what = ['gjorda', 'insläppta'] }: { rows: ScatterRow[]; xLabel?: string; what?: [string, string] }) {
  const { teams, fav } = useData()
  const W = useChartWidth(560)
  const pts = rows.filter((r) => r.x != null && r.y != null) as (ScatterRow & { x: number; y: number })[]
  if (!pts.length) return <Empty>Inga spelade matcher ännu.</Empty>
  const H = Math.round(W * 0.78), p = 44
  const xs = pts.map((r) => r.x), ys = pts.map((r) => r.y)
  const [x0, x1] = [Math.min(...xs) - 0.2, Math.max(...xs) + 0.2], [y0, y1] = [Math.min(...ys) - 0.2, Math.max(...ys) + 0.2]
  const X = (v: number) => p + (v - x0) / (x1 - x0) * (W - 2 * p), Y = (v: number) => p / 2 + (v - y0) / (y1 - y0) * (H - 1.5 * p)
  const mx = sum(xs) / xs.length, my = sum(ys) / ys.length
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Gjorda mot insläppta mål per match">
      <line x1={X(mx)} x2={X(mx)} y1={p / 2} y2={H - p} style={{ stroke: 'var(--line)' }} strokeDasharray="4 4" />
      <line x1={p} x2={W - p} y1={Y(my)} y2={Y(my)} style={{ stroke: 'var(--line)' }} strokeDasharray="4 4" />
      <text x={W / 2} y={H - 8} textAnchor="middle" fontSize="12" style={{ fill: 'var(--muted)' }}>{xLabel} →</text>
      <text x="14" y={H / 2} textAnchor="middle" fontSize="12" style={{ fill: 'var(--muted)' }} transform={`rotate(-90 14 ${H / 2})`}>← Fler insläppta · Färre insläppta →</text>
      {[x0, (x0 + x1) / 2, x1].map((t, i) => <text key={i} x={X(t)} y={H - p + 16} textAnchor="middle" fontSize="11" style={{ fill: 'var(--faint)' }}>{dec(t, 1)}</text>)}
      {pts.map((r) => {
        const cx = X(r.x), cy = Y(r.y), logo = teams[r.code]?.logo
        return (
          <a key={r.code} href={`#/lag/${r.code}`}>
            <circle cx={cx} cy={cy} r="18" style={{ fill: 'var(--panel-2)', stroke: r.code === fav ? 'var(--accent)' : 'var(--line)' }} strokeWidth={r.code === fav ? 2.5 : 1} />
            {logo
              ? <image href={logo} x={cx - 13} y={cy - 13} width="26" height="26"><title>{`${r.name}: ${dec(r.x, 2)} ${what[0]}, ${dec(r.y, 2)} ${what[1]}`}</title></image>
              : <text x={cx} y={cy + 4} textAnchor="middle" fontSize="10" fontWeight="700" style={{ fill: 'var(--text)' }}>{r.code}</text>}
          </a>
        )
      })}
    </svg>
  )
}

// Powerplay and box play per team; box play bars start at 50 %, since every team kills most penalties
export function SpecialTeams({ rows }: { rows: { code: string; name: string; pp: number | null; pk: number | null }[] }) {
  const { teams } = useData()
  const narrow = useNarrow(), W = useChartWidth(560)
  const list = rows.filter((r) => r.pp != null || r.pk != null).sort((a, b) => ((b.pp || 0) + (b.pk || 0)) - ((a.pp || 0) + (a.pk || 0)))
  if (!list.length) return <Empty>Inga spelade matcher ännu.</Empty>
  const rowH = narrow ? 30 : 26, left = narrow ? 84 : 150, mid = left + (W - left) / 2, half = (W - left) / 2 - 30, H = list.length * rowH + 28
  const pkW = (pk: number) => Math.max(0, (pk - 0.5) / 0.5) * half
  return (
    <>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Powerplay och boxplay">
        <text x={mid - 8} y="14" textAnchor="end" fontSize="12" style={{ fill: 'var(--muted)' }}>Powerplay %</text>
        <text x={mid + 8} y="14" fontSize="12" style={{ fill: 'var(--muted)' }}>Boxplay %</text>
        {list.map((r, i) => {
          const y = 24 + i * rowH, pp = r.pp || 0, pk = r.pk || 0
          return (
            <g key={r.code}>
              <text x={left - 32} y={y + 16} textAnchor="end" fontSize="13.5" style={{ fill: 'var(--text)' }}>{narrow ? r.code : r.name}</text>
              {teams[r.code]?.logo && <image href={teams[r.code].logo} x={left - 26} y={y + 3} width="20" height="20" />}
              <rect x={mid - 4 - pp * half} y={y + 5} width={pp * half} height={rowH - 10} rx="3" style={{ fill: 'var(--accent)' }}><title>{`${r.name} powerplay ${pctTxt(pp, 1)}`}</title></rect>
              <text x={mid - 8 - pp * half} y={y + 17} textAnchor="end" fontSize="11" style={{ fill: 'var(--muted)' }}>{Math.round(pp * 100)}</text>
              <rect x={mid + 4} y={y + 5} width={pkW(pk)} height={rowH - 10} rx="3" style={{ fill: 'var(--good)' }}><title>{`${r.name} boxplay ${pctTxt(pk, 1)}`}</title></rect>
              <text x={mid + 8 + pkW(pk)} y={y + 17} fontSize="11" style={{ fill: 'var(--muted)' }}>{Math.round(pk * 100)}</text>
            </g>
          )
        })}
      </svg>
      <p className="note">Boxplaystapeln börjar på 50 % för att skillnaderna ska synas.</p>
    </>
  )
}

// A team badge drawn inside a chart: the logo, or the code on the club colour if there is no logo or it fails
function SvgBadge({ code, x, y }: { code: string; x: number; y: number }) {
  const { teams } = useData()
  const [broken, setBroken] = useState(false)
  const logo = !broken && teams[code]?.logo
  if (logo) return <image href={logo} x={x + 2} y={y - 2} width="20" height="20" onError={() => setBroken(true)} />
  return (
    <g>
      <rect x={x} y={y} width="24" height="16" rx="4" style={{ fill: tColor(code) }} />
      <text x={x + 12} y={y + 11.5} textAnchor="middle" fontSize="8.5" fontWeight="700" style={{ fill: (TC[code] || [0, '#fff'])[1] }}>{code}</text>
    </g>
  )
}

// Goalies: goals saved above an average SHL goalie (doesn't account for shot quality)
export function GsaaChart({ season, label, isCur }: { season: Season; label: string; isCur: boolean }) {
  const narrow = useNarrow(), W = useChartWidth(640)
  const minMin = isCur ? 60 : 600
  const rows = season.goalies.filter((g) => g.mins >= minMin).map((g) => ({ ...g, v: gsaa(g, season) })).sort((a, b) => b.v - a.v) as (Goalie & { v: number })[]
  if (!rows.length) return <Empty>Inga målvakter med tillräckligt många minuter ännu.</Empty>
  const rowH = narrow ? 28 : 22, top = 26, left = narrow ? 140 : 160, right = 46, plotW = W - left - right, H = top + rows.length * rowH + 8
  const ext = Math.max(1, ...rows.map((g) => Math.abs(g.v)))
  const step = ext > 20 ? 10 : ext > 8 ? 5 : ext > 4 ? 2 : 1, lim = Math.ceil(ext / step) * step
  const x = (v: number) => left + (v + lim) / (2 * lim) * plotW
  const ticks = []
  for (let t = -lim; t <= lim; t += step) ticks.push(t)
  const fs = narrow ? 13.5 : 12.5, mid = rowH / 2 // text sits on the row's centre line
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Räddade mål över genomsnittet, ${label}`}>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={x(t)} x2={x(t)} y1={top - 6} y2={H - 6} style={{ stroke: 'var(--line)' }} strokeWidth={t === 0 ? 1.5 : 1} />
          <text x={x(t)} y={top - 12} textAnchor="middle" fontSize="11" style={{ fill: 'var(--muted)' }}>{t > 0 ? '+' : ''}{t}</text>
        </g>
      ))}
      {rows.map((g, i) => {
        const y = top + i * rowH, v = g.v, x0 = x(0), x1 = x(v)
        return (
          <g key={g.id}>
            <a href={`#/spelare/${encodeURIComponent(g.id)}`}><text x={left - 34} y={y + mid + 4.5} textAnchor="end" fontSize={fs} style={{ fill: 'var(--text)' }}>{g.name}</text></a>
            <SvgBadge code={g.team} x={left - 29} y={y + mid - 8} />
            <rect x={Math.min(x0, x1)} y={y + 4} width={Math.max(1, Math.abs(x1 - x0))} height={rowH - 8} rx="3" style={{ fill: v >= 0 ? 'var(--accent)' : 'var(--bad)' }}>
              <title>{`${g.name}: ${dec(v)} GSAA, ${dec(g.svp, 2)} % räddningar, ${g.gpi} matcher`}</title>
            </rect>
            <text x={v >= 0 ? x1 + 5 : x1 - 5} y={y + mid + 4} textAnchor={v >= 0 ? 'start' : 'end'} fontSize={fs - 0.5} fontWeight="600" style={{ fill: 'var(--muted)' }}>{v > 0 ? '+' : ''}{dec(v)}</text>
          </g>
        )
      })}
    </svg>
  )
}
