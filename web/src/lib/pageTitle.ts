import { useEffect, useSyncExternalStore } from 'react'

// The page's name: the browser tab ("Lucas Elvenes · SHLstats") and the phone header, which otherwise shows the
// section name (Spelare, Lag …). A name belongs to the address it was set on, so it never lingers on the next page.
let current: { hash: string; name: string; phone: boolean } | null = null
const subs = new Set<() => void>()
const subscribe = (cb: () => void) => { subs.add(cb); return () => { subs.delete(cb) } }

// phone: false keeps the section name in the phone header (a news headline is too long for it)
export function usePageTitle(name: string | null | undefined, { phone = true } = {}) {
  useEffect(() => {
    current = name ? { hash: location.hash, name, phone } : null
    subs.forEach((f) => f())
  }, [name, phone])
}

// The current page's own name, if it set one (for the phone header: only names meant for it)
export function usePageName(path: string, { phone = false } = {}) {
  const v = useSyncExternalStore(subscribe, () => current)
  return v && decodeURIComponent(v.hash.replace(/^#/, '')) === path && (!phone || v.phone) ? v.name : null
}
