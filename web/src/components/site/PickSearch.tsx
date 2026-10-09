import { useEffect, useMemo, useRef, useState } from 'react'
import { searchHits, useSearchIndex, type Hit } from '@/data/searchIndex'
import { POS } from '@/lib/format'
import { Avatar, TeamBadge } from './TeamBadge'

// A search box inside a card that picks a player (or team) for the card instead of opening their page
export function PickSearch({ id, placeholder, label, filter, onPick }: {
  id?: string
  placeholder: string
  label: string
  filter: (h: Hit) => boolean
  onPick: (h: Hit) => void
}) {
  const index = useSearchIndex()
  const box = useRef<HTMLDivElement>(null), input = useRef<HTMLInputElement>(null)
  const [q, setQ] = useState('')
  const [sel, setSel] = useState(0)
  const [open, setOpen] = useState(false)
  const hits = useMemo(() => searchHits(index, q, filter), [index, q, filter])

  useEffect(() => {
    const onClick = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('click', onClick)
    return () => document.removeEventListener('click', onClick)
  }, [])
  const pick = (h: Hit) => { setQ(''); setOpen(false); input.current?.blur(); onPick(h) }
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { setOpen(false); input.current?.blur(); return }
    if (!open || !hits.length) return
    if (e.key === 'ArrowDown') { setSel((sel + 1) % hits.length); e.preventDefault() }
    else if (e.key === 'ArrowUp') { setSel((sel - 1 + hits.length) % hits.length); e.preventDefault() }
    else if (e.key === 'Enter') { e.preventDefault(); pick(hits[sel]) }
  }
  return (
    <div className="search" id={id} ref={box}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
      <input ref={input} type="search" placeholder={placeholder} autoComplete="off" aria-label={label} value={q}
        onChange={(e) => { setQ(e.target.value); setSel(0); setOpen(!!e.target.value.trim()) }} onKeyDown={onKeyDown} />
      <div className="results" hidden={!open}>
        {hits.length ? hits.map((x, i) => (
          <a key={x.type + x.id} href={x.type === 't' ? `#/lag/${x.id}` : `#/spelare/${x.id}`} className={i === sel ? 'on' : ''} onClick={(e) => { e.preventDefault(); pick(x) }}>
            {x.type === 't' ? <TeamBadge code={x.id} /> : <><Avatar id={x.id} name={x.name} team={x.team} /><TeamBadge code={x.team} /></>}
            {' '}{x.name} <small>{x.type === 't' ? 'Lag' : POS[x.pos || ''] || ''}</small>
          </a>
        )) : <div className="empty">Inga träffar.</div>}
      </div>
    </div>
  )
}
