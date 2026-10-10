import { LineChart as ArcLineChart, type LineChartStrings } from '@/components/arc/line-chart/line-chart'
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

export interface Series { pts: number[]; color: string; label: string; area?: boolean }

const CHART_STRINGS: LineChartStrings = { series: 'serier', exploreBy: 'utforska per', chooseSeries: 'Välj en serie att visa', of: 'av', shown: 'serier visas', to: 'till', latest: 'senast', loading: 'Laddar' }

// Lines over time: Arc's line chart, with a crosshair readout of every series and toggles when there are several.
// fromZero false lets the axis start near the data (save percentages).
export function LineChart({ series, label, xLabels, yFmt = (v) => String(v), fromZero = true, category = 'Datum', height = 220 }: {
  series: Series[]
  label: string
  xLabels: string[]
  yFmt?: (v: number) => string
  fromZero?: boolean
  category?: string
  height?: number
}) {
  const data = xLabels.map((x, i) => ({ key: String(i), label: x, axisLabel: x, values: Object.fromEntries(series.map((s, k) => [`s${k}`, s.pts[i]])) }))
  return (
    <ArcLineChart data={data} series={series.map((s, k) => ({ key: `s${k}`, label: s.label, color: s.color, area: !!s.area }))}
      label={label} categoryLabel={category} height={height} fromZero={fromZero} locale="sv-SE" strings={CHART_STRINGS}
      formatTick={yFmt} formatValue={(v) => yFmt(v)} emptyLabel="Inga värden ännu" />
  )
}
