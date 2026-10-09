import { useData } from '@/data/context'
import { oddsTxt } from '@/lib/format'
import { useChartWidth, useNarrow } from '@/lib/useNarrow'

export interface Bar { label: string; v: number; code?: string }

// Horizontal bars with a label on the left (and optionally the team logo) and the value after the bar.
// Narrow screens show team codes instead of full names so the bars keep their room.
export function HBars({ items, max, fmt = (v) => oddsTxt(v), color = () => 'var(--accent)', labelW = 150, rowH = 24, W = 600, logos = false }: {
  items: Bar[]
  max?: number
  fmt?: (v: number) => string | number
  color?: (it: Bar, i: number) => string
  labelW?: number
  rowH?: number
  W?: number
  logos?: boolean
}) {
  const { teams } = useData()
  const narrow = useNarrow()
  W = useChartWidth(W)
  if (narrow && labelW > 90 && items.every((it) => it.code)) { items = items.map((it) => ({ ...it, label: it.code! })); labelW = 52; rowH = Math.max(rowH, 28) }
  const mx = max ?? Math.max(1e-9, ...items.map((i) => i.v))
  const lw = labelW + (logos ? 26 : 0), plotW = W - lw - 58, H = items.length * rowH + 4
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img">
      {items.map((it, i) => {
        const y = i * rowH + 2, w = Math.max(it.v > 0 ? 2 : 0, it.v / mx * plotW), logo = logos && it.code && teams[it.code]?.logo
        return (
          <g key={i}>
            <text x={labelW - 6} y={y + rowH / 2 + 4} textAnchor="end" fontSize="13" style={{ fill: 'var(--text)' }}>{it.label}</text>
            {logo && <image href={logo} x={lw - 24} y={y + 3} width={rowH - 6} height={rowH - 6} />}
            <rect x={lw} y={y + 5} width={plotW} height={rowH - 10} rx="3" style={{ fill: 'var(--panel-2)' }} />
            <rect x={lw} y={y + 5} width={w} height={rowH - 10} rx="3" style={{ fill: color(it, i) }}><title>{`${it.label}: ${fmt(it.v)}`}</title></rect>
            <text x={lw + w + 6} y={y + rowH / 2 + 4} fontSize="12" fontWeight="600" style={{ fill: 'var(--muted)' }}>{fmt(it.v)}</text>
          </g>
        )
      })}
    </svg>
  )
}

export interface Series { pts: number[]; color: string; area?: boolean }

// Lines over time with a grid, y labels on the left and a few x labels along the bottom
export function LineChart({ series, W = 640, H = 220, yMax, yMin = 0, yFmt = (v) => v, xLabels = [], pad = { l: 44, r: 16, t: 12, b: 26 } }: {
  series: Series[]
  W?: number
  H?: number
  yMax?: number
  yMin?: number
  yFmt?: (v: number) => string | number
  xLabels?: string[]
  pad?: { l: number; r: number; t: number; b: number }
}) {
  const narrow = useNarrow()
  const w = useChartWidth(W)
  if (narrow) { H = Math.round(H * Math.max(0.8, w / W)); W = w }
  const n = Math.max(...series.map((s) => s.pts.length))
  const top = yMax ?? Math.max(1, ...series.flatMap((s) => s.pts)) * 1.05
  const x = (i: number) => pad.l + (n <= 1 ? 0 : i / (n - 1)) * (W - pad.l - pad.r)
  const y = (v: number) => pad.t + (1 - (v - yMin) / (top - yMin || 1)) * (H - pad.t - pad.b)
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => yMin + t * (top - yMin))
  const step = Math.max(1, Math.ceil(xLabels.length / 7))
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img">
      {ticks.map((t, i) => (
        <g key={i}>
          <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} style={{ stroke: 'var(--line)' }} />
          <text x={pad.l - 6} y={y(t) + 4} textAnchor="end" fontSize="11" style={{ fill: 'var(--faint)' }}>{yFmt(t)}</text>
        </g>
      ))}
      {xLabels.map((lab, i) => (i % step === 0 || i === xLabels.length - 1)
        ? <text key={i} x={x(i)} y={H - 6} textAnchor="middle" fontSize="11" style={{ fill: 'var(--faint)' }}>{lab}</text> : null)}
      {series.map((s, k) => {
        const d = s.pts.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('')
        const li = s.pts.length - 1
        return (
          <g key={k}>
            {s.area && <path d={`${d}L${x(li)},${y(yMin)}L${x(0)},${y(yMin)}Z`} style={{ fill: s.color, opacity: 0.12 }} />}
            <path d={d} style={{ fill: 'none', stroke: s.color }} strokeWidth="2.4" strokeLinejoin="round" />
            <circle cx={x(li)} cy={y(s.pts[li])} r="4" style={{ fill: s.color }} />
          </g>
        )
      })}
    </svg>
  )
}
