import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useData } from '@/data/context'
import { navKey, segOf, TITLES } from '@/lib/router'
import { THEMES, useTheme, type ThemeName } from '@/lib/theme'
import { Icon } from './Icon'
import { Search } from './Search'
import { SlideIndicator } from './SlideIndicator'
import { TeamBadge } from './TeamBadge'

const MAIN_NAV: [string, string, string][] = [
  ['statistik', 'Statistik', 'chart'],
  ['tabell', 'Tabell', 'table'],
  ['matcher', 'Matcher', 'calendar'],
  ['nexus', 'Nexus (beta)', 'target'], // desktop only for now: the top menu is hidden on phones
]

export const THEME_ICON: Record<ThemeName, ReactNode> = {
  dark: <svg viewBox="0 0 24 24" fill="currentColor"><path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" /></svg>,
  light: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="4.2" /><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8" /></svg>,
  paper: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"><path d="M6 3h8l4 4v14H6Z" /><path d="M14 3v4h4M9 12h6M9 16h6" /></svg>,
}
const THEME_LABEL: Record<ThemeName, [string, string]> = { dark: ['Mörkt', 'Mörkt tema'], light: ['Ljust', 'Ljust tema'], paper: ['Papper', 'Papperstema'] }

export function Header({ path, searchOpen, setSearchOpen, onSettings }: {
  path: string
  searchOpen: boolean
  setSearchOpen: (v: boolean) => void
  onSettings: () => void
}) {
  const seg = segOf(path), active = navKey(seg)
  return (
    <header className="top">
      <div className="top-in">
        <a className="brand" href="#/" aria-label="SHLstats startsida">
          <img className="brand-mark" src="icons/logo-mark.png?v=3" alt="" width="50" height="25" />
          <span className="brand-word">SHL<em>stats</em></span>
        </a>
        {/* Phones: the page name (with a back arrow on sub pages) replaces the logo outside Hem */}
        <button className="m-back" aria-label="Tillbaka" onClick={() => { if (history.length > 1) history.back(); else location.hash = '#/' }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M15 5l-7 7 7 7" /></svg>
        </button>
        <span className="m-title brand-word">{TITLES[seg] || ''}</span>
        <nav className="main has-ind" aria-label="Sidor">
          <SlideIndicator kind="pill" active=".on" groupKey="nav.main" dep={active} />
          {MAIN_NAV.map(([key, label, icon]) => (
            <a key={key} href={`#/${key}`} className={active === key ? 'on' : undefined} aria-current={active === key ? 'page' : undefined}>
              <Icon name={icon} /><span className="nl">{label}</span>
            </a>
          ))}
        </nav>
        <div className="top-tools">
          <button className="settings-btn" aria-label="Inställningar" onClick={onSettings}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3.2" /><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.03 1.56V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1.11-1.56 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.54 15a1.7 1.7 0 0 0-1.56-1.03H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.65 8.9a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34H9a1.7 1.7 0 0 0 1.03-1.56V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1.03 1.56 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87V9c.26.6.85 1 1.51 1.03H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.51 1.03z" /></svg>
          </button>
          <FavLink />
          <Search open={searchOpen} setOpen={setSearchOpen} />
          <ThemeMenu />
        </div>
      </div>
    </header>
  )
}

// Shortcut to your team's page
function FavLink() {
  const { fav, teams, tName } = useData()
  if (!fav || !teams[fav]) return null
  return (
    <a className="favlink" href={`#/lag/${fav}`} title={`Mitt lag: ${tName(fav)}`} aria-label={`Mitt lag: ${tName(fav)}`}>
      <TeamBadge code={fav} /><span>{fav}</span>
    </a>
  )
}

// Theme: one button showing the current theme; it opens a small menu with the three themes
function ThemeMenu() {
  const { current, setTheme } = useTheme()
  const [open, setOpen] = useState(false)
  const menu = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const onClick = (e: MouseEvent) => { if (!menu.current?.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('click', onClick)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('click', onClick); document.removeEventListener('keydown', onKey) }
  }, [])
  return (
    <div className={`theme-menu ${open ? 'open' : ''}`} ref={menu}>
      <button className="theme-btn" aria-haspopup="true" aria-expanded={open} aria-label="Färgtema" title="Färgtema" onClick={() => setOpen(!open)}>
        {THEME_ICON[current]}
      </button>
      <div className="theme-toggle has-ind" role="group" aria-label="Färgtema">
        <SlideIndicator kind="pill" active='[aria-pressed="true"]' groupKey="theme-toggle" dep={`${current}|${open}`} />
        {THEMES.map((t) => (
          <button key={t} aria-label={THEME_LABEL[t][1]} aria-pressed={t === current} onClick={() => { setTheme(t); setOpen(false) }}>
            {THEME_ICON[t]}<span>{THEME_LABEL[t][0]}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
