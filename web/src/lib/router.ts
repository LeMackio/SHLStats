import { useSyncExternalStore } from 'react'

// Hash routing like the original site (#/tabell, #/spelare/<id>/karriar …), so every old link keeps working
// and the site runs from any static host without server rewrites.

const subscribe = (cb: () => void) => {
  window.addEventListener('hashchange', cb)
  return () => window.removeEventListener('hashchange', cb)
}
const currentPath = () => decodeURIComponent(location.hash.replace(/^#/, '')) || '/'

export function usePath() {
  return useSyncExternalStore(subscribe, currentPath)
}

// The first part of the path: '' (Hem), 'tabell', 'match' …
export const segOf = (path: string) => path.split('/')[1] || ''

// Pages under another menu entry: a match lives under Matcher, a player under Statistik …
export const NAV_OF: Record<string, string> = { match: 'matcher', spelare: 'statistik', lag: 'tabell', avancerat: 'nexus' }
export const navKey = (seg: string) => NAV_OF[seg] ?? seg

// The page name in the phone header
export const TITLES: Record<string, string> = {
  matcher: 'Matcher', statistik: 'Statistik', tabell: 'Tabell', media: 'Media', match: 'Match', spelare: 'Spelare',
  lag: 'Lag', nyheter: 'Nyheter', nexus: 'Nexus', avancerat: 'Nexus',
}
// Sub pages get a back arrow on phones
export const SUB_PAGES = ['match', 'spelare', 'lag', 'nyheter']

export const go = (hash: string) => { location.hash = hash }
