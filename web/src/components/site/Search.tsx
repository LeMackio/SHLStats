import { useEffect, useMemo, useRef, useState } from 'react'
import { useData } from '@/data/context'
import { isNarrow, normName, POS } from '@/lib/format'
import { go } from '@/lib/router'
import { Icon } from './Icon'
import { Avatar, TeamBadge } from './TeamBadge'

interface Hit { type: 'p' | 't'; id: string; name: string; team: string; pos?: string; key: string; gp: number }

// Players from this season and last, plus the current teams; this season's players rank first
function useSearchIndex() {
  const { core, cur, prev, codes, tName } = useData()
  return useMemo(() => {
    const out: Hit[] = [], seen = new Set<string>()
    for (const season of [cur, prev]) for (const p of [...core.seasons[season].skaters, ...core.seasons[season].goalies]) {
      if (seen.has(p.id)) continue
      seen.add(p.id)
      out.push({ type: 'p', id: p.id, name: p.name, team: p.team, pos: p.pos, key: normName(p.name), gp: ((p as { gp?: number }).gp || (p as { gpi?: number }).gpi || 0) + (season === cur ? 100 : 0) })
    }
    for (const c of codes) out.push({ type: 't', id: c, name: tName(c), team: c, key: normName(tName(c) + ' ' + c), gp: 1000 })
    return out
  }, [core, cur, prev, codes, tName])
}

const hrefOf = (x: Hit) => x.type === 't' ? `#/lag/${x.id}` : `#/spelare/${x.id}`

// The search in the header: phones get a full-screen search sheet, computers a round button that widens into the field
export function Search({ open, setOpen }: { open: boolean; setOpen: (v: boolean) => void }) {
  const index = useSearchIndex()
  const input = useRef<HTMLInputElement>(null)
  const box = useRef<HTMLDivElement>(null)
  const [q, setQ] = useState('')
  const [sel, setSel] = useState(0)
  const [showResults, setShowResults] = useState(false)

  const hits = useMemo(() => {
    const k = normName(q.trim())
    if (!k) return []
    return index.filter((x) => x.key.includes(k))
      .sort((a, b) => (Number(b.key.startsWith(k)) - Number(a.key.startsWith(k))) || b.gp - a.gp).slice(0, 8)
  }, [index, q])

  const close = () => { setOpen(false); setQ(''); setShowResults(false) }
  const pick = (x: Hit) => { close(); input.current?.blur(); go(hrefOf(x)) }

  useEffect(() => { if (open) input.current?.focus() }, [open])
  // A new page closes the search with nothing left in it
  useEffect(() => {
    const onHash = () => { setOpen(false); setQ(''); setShowResults(false) }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [setOpen])
  // "/" focuses search from anywhere; a click outside hides the results
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = document.activeElement?.tagName || ''
      if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(tag) && !document.querySelector('dialog.video[open]')) { e.preventDefault(); setOpen(true); input.current?.focus() }
    }
    const onClick = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setShowResults(false) }
    document.addEventListener('keydown', onKey)
    document.addEventListener('click', onClick)
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('click', onClick) }
  }, [setOpen])

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { close(); input.current?.blur(); return }
    if (!showResults || !hits.length) return
    if (e.key === 'ArrowDown') { setSel((sel + 1) % hits.length); e.preventDefault() }
    else if (e.key === 'ArrowUp') { setSel((sel - 1 + hits.length) % hits.length); e.preventDefault() }
    else if (e.key === 'Enter') { e.preventDefault(); pick(hits[sel]) }
  }
  // Computers: an empty field folds back into the button when you leave it
  const onBlur = () => {
    if (!isNarrow() && !q) setTimeout(() => { if (document.activeElement !== input.current) close() }, 150)
  }

  return (
    <div className="gsearch" ref={box}>
      <button className="search-toggle" aria-label="Sök spelare eller lag" onClick={() => setOpen(true)}><Icon name="search" /></button>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
      <input
        ref={input} id="gsearch" type="search" placeholder="Sök spelare eller lag" autoComplete="off" aria-label="Sök spelare eller lag" enterKeyHint="search"
        value={q} onChange={(e) => { setQ(e.target.value); setSel(0); setShowResults(!!e.target.value.trim()) }} onKeyDown={onKeyDown} onBlur={onBlur}
      />
      <kbd className="kbd" aria-hidden="true">/</kbd>
      <button className="search-cancel" onClick={close}>Avbryt</button>
      <div className="results" id="gsearch-results" hidden={!showResults}>
        {hits.length ? hits.map((x, i) => (
          <a key={x.type + x.id} href={hrefOf(x)} className={i === sel ? 'on' : ''} onClick={(e) => { e.preventDefault(); pick(x) }}>
            {x.type === 't' ? <TeamBadge code={x.id} /> : <><Avatar id={x.id} name={x.name} team={x.team} /><TeamBadge code={x.team} /></>}
            {' '}{x.name} <small>{x.type === 't' ? 'Lag' : POS[x.pos || ''] || ''}</small>
          </a>
        )) : <div className="empty">Inga träffar.</div>}
      </div>
    </div>
  )
}
