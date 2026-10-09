import { useMemo, useState, type ReactNode } from 'react'
import { dec } from '@/lib/format'

export interface Col<R> {
  k: string
  label: ReactNode
  sub?: ReactNode // second line in the header
  title?: string // header tooltip
  l?: boolean // left-aligned (names)
  asc?: boolean // sorts low-to-high first (goals against, names …)
  noSort?: boolean
  v?: (r: R) => number | string | null | undefined // the value to sort and show (default: r[k])
  f?: (v: never) => ReactNode // how to show the value
  h?: (r: R, i: number) => ReactNode // a whole custom cell
}

const fmtCell = (v: unknown, c: Col<never>): ReactNode =>
  v == null ? '–' : c.f ? c.f(v as never) : typeof v === 'number' && !Number.isInteger(v) ? dec(v, 1) : String(v)

// A table sorted by clicking its column headers. With a limit, it shows the top rows and a "Visa alla" button.
export function SortableTable<R extends { team?: string }>({ cols, rows, sortKey, desc: desc0 = true, limit = 0, fav, className = 't stick', minWidth }: {
  cols: Col<R>[]
  rows: R[]
  sortKey: string
  desc?: boolean
  limit?: number
  fav?: string | null // rows of this team are highlighted
  className?: string
  minWidth?: number
}) {
  const [k, setK] = useState(sortKey)
  const [desc, setDesc] = useState(desc0)
  const [all, setAll] = useState(false)
  const colOf = (kk: string) => cols.find((c) => c.k === kk) || cols[0]
  const val = (c: Col<R>, r: R) => (c.v ? c.v(r) : (r as Record<string, unknown>)[c.k]) as number | string | null | undefined

  const sorted = useMemo(() => {
    const c = colOf(k)
    return [...rows].sort((a, b) => {
      const x = val(c, a), y = val(c, b)
      if (typeof x === 'string' || typeof y === 'string') return (desc ? -1 : 1) * String(x ?? '').localeCompare(String(y ?? ''), 'sv')
      const xx = x ?? (desc ? -Infinity : Infinity), yy = y ?? (desc ? -Infinity : Infinity)
      return desc ? yy - xx : xx - yy
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, k, desc, cols])
  const shown = limit && !all ? sorted.slice(0, limit) : sorted

  const onSort = (c: Col<R>) => {
    if (c.noSort) return
    if (c.k === k) setDesc(!desc)
    else { setK(c.k); setDesc(!c.asc) }
  }

  return (
    <>
      <div className="tscroll">
        <table className={className} style={minWidth ? { minWidth } : undefined}>
          <thead>
            <tr>
              {cols.map((c) => (
                <th key={c.k} className={[c.l && 'l', !c.noSort && 'sortable', c.k === k && (desc ? 'sorted' : 'sorted asc')].filter(Boolean).join(' ')}
                  title={c.title} onClick={() => onSort(c)}>
                  {c.label}{c.sub && <small>{c.sub}</small>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((r, i) => (
              <tr key={(r as { id?: string; code?: string }).id ?? (r as { code?: string }).code ?? i} className={fav && r.team === fav ? 'fav' : undefined}>
                {cols.map((c) => (
                  <td key={c.k} className={[c.l && 'l', c.k === k && !c.l && 'hl'].filter(Boolean).join(' ') || undefined}>
                    {c.h ? c.h(r, i) : fmtCell(val(c, r), c as Col<never>)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {limit > 0 && sorted.length > limit && (
        <button className="more" onClick={() => setAll(!all)}>{all ? 'Visa färre' : `Visa alla ${sorted.length}`}</button>
      )}
    </>
  )
}
