import * as DialogPrimitive from '@radix-ui/react-dialog'
import { CalendarDays, ChartColumn, House, Play, Table, Target, Trophy } from 'lucide-react'
import { useCallback, useEffect, useMemo } from 'react'
import { CommandPalette, type CommandItem } from '@/components/arc/command-palette/command-palette'
import arcDialog from '@/components/arc/dialog/dialog.module.css'
import { useData } from '@/data/context'
import { searchHits, useSearchIndex } from '@/data/searchIndex'
import { POS } from '@/lib/format'
import { go } from '@/lib/router'
import styles from './SearchPalette.module.css'
import { Avatar, TeamBadge } from './TeamBadge'

const icon = { size: 16, strokeWidth: 1.75, 'aria-hidden': true } as const
// Each item's id is the address it opens
const PAGES: CommandItem[] = [
  { id: '#/', label: 'Hem', group: 'Sidor', icon: <House {...icon} /> },
  { id: '#/matcher', label: 'Matcher', group: 'Sidor', icon: <CalendarDays {...icon} />, keywords: ['schema', 'resultat'] },
  { id: '#/tabell', label: 'Tabell', group: 'Sidor', icon: <Table {...icon} />, keywords: ['serietabell'] },
  { id: '#/tabell/odds', label: 'Odds', description: 'Slutspelschanser och prognos', group: 'Sidor', icon: <Trophy {...icon} />, keywords: ['slutspel', 'prognos', 'guld'] },
  { id: '#/statistik', label: 'Statistik', group: 'Sidor', icon: <ChartColumn {...icon} />, keywords: ['poängliga', 'målvakter'] },
  { id: '#/nexus', label: 'Nexus', description: 'Skottkvalitet och xG', group: 'Sidor', icon: <Target {...icon} />, keywords: ['xg', 'skott'] },
  { id: '#/media', label: 'Media', description: 'Målvideor och sammandrag', group: 'Sidor', icon: <Play {...icon} />, keywords: ['video', 'mål'] },
]

// Search across the site (⌘K, Ctrl K or "/"): pages and teams straight away, players and teams as you type.
// Arc's command palette in a modal layer with Arc's dialog overlay.
export function SearchPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { codes, tName, fav } = useData()
  const index = useSearchIndex()

  // ⌘K / Ctrl K and "/" open it from anywhere ("/" not while typing in a field or with another dialog open)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || '')
      if (((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') || (e.key === '/' && !typing && !document.querySelector('[role="dialog"]'))) {
        e.preventDefault()
        onOpenChange(true)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onOpenChange])

  const teamItem = useCallback((c: string): CommandItem => ({
    id: `#/lag/${c}`, label: tName(c), description: c === fav ? 'Mitt lag' : c, group: 'Lag', icon: <TeamBadge code={c} />,
  }), [tName, fav])
  // With nothing typed: the pages, then the teams (your own first)
  const start = useMemo(() => [
    ...PAGES,
    ...[...codes].sort((a, b) => Number(b === fav) - Number(a === fav) || tName(a).localeCompare(tName(b), 'sv')).map(teamItem),
  ], [codes, fav, tName, teamItem])

  // Typed: matching pages, then the site's own ranked player and team search (names starting with the text first, then
  // the most games played), at most eight
  const search = useCallback((_items: CommandItem[], query: string) => {
    const q = query.trim().toLowerCase()
    return !q ? start : [
      ...PAGES.filter((p) => [p.label, ...(p.keywords || [])].some((w) => w.toLowerCase().includes(q))),
      ...searchHits(index, query).map((h) => h.type === 't' ? teamItem(h.id) : {
        // Some of last season's players have no position: then just the team
        id: `#/spelare/${h.id}`, label: h.name, description: POS[h.pos || ''] ? `${h.team} · ${POS[h.pos || '']}` : h.team, group: 'Spelare',
        icon: <Avatar id={h.id} name={h.name} team={h.team} />,
      }),
    ]
  }, [start, index, teamItem])

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className={`${arcDialog.overlay} ${arcDialog.keyframes}`} />
        <DialogPrimitive.Content className={styles.content} aria-describedby={undefined}>
          <DialogPrimitive.Title className={styles.hidden}>Sök</DialogPrimitive.Title>
          <CommandPalette items={start} search={search} autoFocus label="Sök spelare, lag eller sida" placeholder="Sök spelare, lag eller sida"
            onClose={() => onOpenChange(false)}
            onSelect={(it) => { onOpenChange(false); go(it.id) }}
            strings={{ results: 'Sökresultat', clear: 'Rensa sökningen', close: 'Stäng sökningen', shortcut: '⌘ K', emptyTitle: 'Inga träffar', emptyHint: 'Prova ett annat namn eller lagets förkortning.' }} />
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
