import { useRef } from 'react'
import { useData } from '@/data/context'
import { navKey, segOf } from '@/lib/router'
import { Icon } from './Icon'
import { SlideIndicator } from './SlideIndicator'
import { TeamBadge } from './TeamBadge'

const ITEMS: [string, string, string][] = [
  ['', 'Hem', 'home'],
  ['matcher', 'Matcher', 'calendar'],
  ['statistik', 'Statistik', 'chart'],
  ['tabell', 'Tabell', 'table'],
  ['media', 'Media', 'play'],
]

// Phones: the main menu as a flat glass bar (or, where the screen gives the page a strip down the right side, a rail in
// that strip: useSideRail). The current page sits in a pill that can be dragged along the bar: it follows the finger,
// the item under it lights up, and letting go opens that page (a tap works as usual). Following a team puts its logo
// on the Hem button in place of the house icon.
export function BottomNav({ path }: { path: string }) {
  const { fav } = useData()
  const active = navKey(segOf(path))
  const nav = useRef<HTMLElement>(null)
  const drag = useRef<{ x0: number; y0: number; moved: boolean; id: number } | null>(null)
  const dragged = useRef(false) // a drag just ended: swallow the click some browsers still send

  const items = () => [...(nav.current?.querySelectorAll<HTMLAnchorElement>(':scope > a') ?? [])]
  const pill = () => nav.current?.querySelector<HTMLElement>('.sl-pill') ?? null
  // Along the bar: sideways for the bottom bar, up and down for the side rail
  const vertical = () => document.body.classList.contains('side-rail')
  const along = (e: { clientX: number; clientY: number }) => { const r = nav.current!.getBoundingClientRect(); return vertical() ? e.clientY - r.top : e.clientX - r.left }
  const start = (a: HTMLElement) => vertical() ? a.offsetTop : a.offsetLeft
  const size = (a: HTMLElement) => vertical() ? a.offsetHeight : a.offsetWidth
  // The item whose centre is closest to a point along the bar
  const nearest = (v: number) => items().reduce((best, a) => Math.abs(start(a) + size(a) / 2 - v) < Math.abs(start(best) + size(best) / 2 - v) ? a : best)
  const placePill = (a: HTMLElement, v?: number) => {
    const p = pill(), bar = nav.current
    if (!p || !bar) return
    const first = items()[0], room = vertical() ? bar.clientHeight : bar.clientWidth
    const pos = v == null ? start(a) : Math.max(start(first), Math.min(v - size(a) / 2, room - size(a) - start(first)))
    p.style.transform = vertical() ? `translate(${a.offsetLeft}px, ${pos}px)` : `translate(${pos}px, ${a.offsetTop}px)`
  }
  const hover = (a: HTMLElement | null) => items().forEach((el) => el.classList.toggle('bn-hover', el === a))

  const down = (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    drag.current = { x0: e.clientX, y0: e.clientY, moved: false, id: e.pointerId }
  }
  const move = (e: React.PointerEvent) => {
    const d = drag.current, bar = nav.current
    if (!d || !bar || d.id !== e.pointerId) return
    if (!d.moved) {
      if ((vertical() ? Math.abs(e.clientY - d.y0) : Math.abs(e.clientX - d.x0)) < 8) return
      d.moved = true
      try { bar.setPointerCapture(e.pointerId) } catch { /* the pointer already ended */ }
      bar.classList.add('bn-dragging')
    }
    const v = along(e), a = nearest(v)
    placePill(a, v)
    hover(a)
  }
  const up = (e: React.PointerEvent) => {
    const d = drag.current, bar = nav.current
    drag.current = null
    if (!d?.moved || !bar) return
    bar.classList.remove('bn-dragging')
    hover(null)
    const a = nearest(along(e))
    placePill(a)
    // The pointer is captured, so no click follows: open the page here (or stay, if it is the current one)
    if (!a.classList.contains('on')) location.hash = a.getAttribute('href')!.slice(1)
    dragged.current = true
    setTimeout(() => { dragged.current = false }, 0)
  }
  const cancel = () => {
    const bar = nav.current
    drag.current = null
    bar?.classList.remove('bn-dragging')
    hover(null)
    const on = items().find((a) => a.classList.contains('on'))
    if (on) placePill(on)
  }

  return (
    <nav ref={nav} className="bottom-nav has-ind" aria-label="Meny" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={cancel}
      onClickCapture={(e) => { if (dragged.current) { e.preventDefault(); e.stopPropagation() } }}>
      <SlideIndicator kind="pill" active=".on" groupKey="bottom-nav" dep={active} />
      {ITEMS.map(([key, label, icon]) => (
        <a key={key} href={`#/${key}`} className={active === key ? 'on' : undefined} aria-current={active === key ? 'page' : undefined} draggable={false}>
          {/* The label in its own element, so the phone menu can fold it away completely when it shrinks */}
          {key === '' && fav ? <span className="bn-team"><TeamBadge code={fav} /></span> : <Icon name={icon} />}
          <span className="nl">{label}</span>
        </a>
      ))}
    </nav>
  )
}

export function Footer({ stamp }: { stamp: string }) {
  return (
    <footer id="foot">
      <p className="foot-upd">Uppdaterad {stamp}</p>
      <p className="foot-sig"><span className="brand-word">SHL<em>stats</em></span></p>
    </footer>
  )
}
