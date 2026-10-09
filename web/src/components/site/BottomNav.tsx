import { navKey, segOf } from '@/lib/router'
import { Icon } from './Icon'
import { SlideIndicator } from './SlideIndicator'

const ITEMS: [string, string, string][] = [
  ['', 'Hem', 'home'],
  ['matcher', 'Matcher', 'calendar'],
  ['statistik', 'Statistik', 'chart'],
  ['tabell', 'Tabell', 'table'],
  ['media', 'Media', 'play'],
]

// Phones: the main menu as a bottom bar
export function BottomNav({ path }: { path: string }) {
  const active = navKey(segOf(path))
  return (
    <nav className="bottom-nav has-ind" aria-label="Meny">
      <SlideIndicator kind="pill" active=".on" groupKey="bottom-nav" dep={active} />
      {ITEMS.map(([key, label, icon]) => (
        <a key={key} href={`#/${key}`} className={active === key ? 'on' : undefined} aria-current={active === key ? 'page' : undefined}>
          {/* The label in its own element, so the phone menu can fold it away completely when it shrinks */}
          <Icon name={icon} /><span className="nl">{label}</span>
        </a>
      ))}
    </nav>
  )
}

export function Footer({ stamp }: { stamp: string }) {
  return (
    <footer id="foot">
      <p className="foot-upd">Uppdaterad {stamp}</p>
      <p className="foot-sig"><span className="brand-word">SHL<em>stats</em></span> by M</p>
    </footer>
  )
}
