import { useMemo } from 'react'
import type { ReactNode } from 'react'
import { SortableDataTable, type DataColumn, type SortableDataTableStrings } from '@/components/arc/sortable-data-table/sortable-data-table'
import { dec } from '@/lib/format'

export interface Col<R> {
  k: string
  label: string
  title?: string // header tooltip
  l?: boolean // left-aligned (names)
  asc?: boolean // sorts low-to-high first (goals against, names …)
  noSort?: boolean
  v?: (r: R) => number | string | null | undefined // the value to sort and show (default: r[k])
  f?: (v: never) => ReactNode // how to show the value
  h?: (r: R, i: number) => ReactNode // a whole custom cell
}

export const TABLE_STRINGS: SortableDataTableStrings = {
  sortBy: 'Sortera efter', currently: 'nu', sortedBy: 'Sorterad efter', ascending: 'stigande', descending: 'fallande',
  selectAll: 'Markera alla rader', select: 'Markera', selected: 'markerade', of: 'av', selectionCleared: 'Markeringen borttagen',
  clearSelection: 'Ta bort markeringen', showAll: (n) => `Visa alla ${n}`, showFewer: 'Visa färre',
}

const fmtCell = (v: unknown, c: Col<never>): ReactNode =>
  v == null ? '–' : c.f ? c.f(v as never) : typeof v === 'number' && !Number.isInteger(v) ? dec(v, 1) : String(v)

type Cells = Record<string, unknown> & { $row: unknown; $key: string }

// A table sorted by clicking its column headers, built on Arc's sortable table. With a limit, it shows the top rows
// and a "Visa alla" button. Wide tables scroll sideways with the first column pinned.
export function SortableTable<R extends { team?: string }>({ cols, rows, sortKey, desc = true, limit = 0, fav, minWidth, caption = 'Tabell' }: {
  cols: Col<R>[]
  rows: R[]
  sortKey: string
  desc?: boolean
  limit?: number
  fav?: string | null // rows of this team are highlighted
  minWidth?: number
  caption?: string
}) {
  // Each row becomes its column values (what is sorted), with the original row kept for custom cells
  const cells = useMemo(() => rows.map((r, i): Cells => {
    const o: Cells = { $row: r, $key: String((r as { id?: string }).id ?? (r as { code?: string }).code ?? i) }
    for (const c of cols) o[c.k] = c.v ? c.v(r) : (r as Record<string, unknown>)[c.k]
    return o
  }), [rows, cols])

  const columns = useMemo(() => cols.map((c): DataColumn<Cells> => ({
    key: c.k, label: c.label, title: c.title, sortable: !c.noSort, numeric: !c.l, firstDirection: c.asc ? 'asc' : 'desc',
    render: (v, row, i) => (c.h ? c.h(row.$row as R, i) : fmtCell(v, c as Col<never>)),
  })), [cols])

  return (
    <SortableDataTable rows={cells} columns={columns} rowKey="$key" caption={caption} emptyMessage="Inga rader att visa"
      defaultSort={{ key: sortKey, direction: desc ? 'desc' : 'asc' }} strings={TABLE_STRINGS} locale="sv"
      rowHighlight={fav ? (row) => (row.$row as R).team === fav : undefined} limit={limit} minWidth={minWidth} fold={false} />
  )
}
