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

// Phones: the main menu as a bottom bar (in the style of the NHL app: a solid rounded bar, the current page in a
// darker pill with its icon and label in blue). Following a team puts its logo on the Hem button in place of the icon.
export function BottomNav({ path }: { path: string }) {
  const { fav } = useData()
  const active = navKey(segOf(path))
  return (
    <nav className="bottom-nav has-ind" aria-label="Meny">
      <SlideIndicator kind="pill" active=".on" groupKey="bottom-nav" dep={active} />
      {ITEMS.map(([key, label, icon]) => (
        <a key={key} href={`#/${key}`} className={active === key ? 'on' : undefined} aria-current={active === key ? 'page' : undefined}>
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
