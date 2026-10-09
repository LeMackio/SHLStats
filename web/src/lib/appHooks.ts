import { useEffect, useRef } from 'react'
import { dataUrl } from '@/data/context'
import { isNarrow } from './format'

// Toggles a class on <body> (the stylesheet keys page-wide layout off a few of these)
export function useBodyClass(cls: string, on: boolean) {
  useEffect(() => {
    document.body.classList.toggle(cls, on)
    return () => document.body.classList.remove(cls)
  }, [cls, on])
}

// Phone menu: shrinks to a compact bar while scrolling down, and grows back when scrolling up or at the top
export function useCompactNav() {
  useEffect(() => {
    let lastY = scrollY, ticking = false
    const onScroll = () => {
      if (ticking) return
      ticking = true
      requestAnimationFrame(() => {
        ticking = false
        const y = scrollY, body = document.body, compact = body.classList.contains('nav-compact')
        if (!isNarrow()) { if (compact) body.classList.remove('nav-compact'); lastY = y; return }
        if (y < 40) { if (compact) body.classList.remove('nav-compact') }
        else if (y > lastY + 6) { if (!compact) body.classList.add('nav-compact') }
        else if (y < lastY - 6) { if (compact) body.classList.remove('nav-compact') }
        if (Math.abs(y - lastY) > 6) lastY = y
      })
    }
    addEventListener('scroll', onScroll, { passive: true })
    return () => removeEventListener('scroll', onScroll)
  }, [])
}

// Pull to refresh (phones): pull down from the top of a page and let go past the line to reload with fresh data.
// Sideways swipes (date tabs, goal chips, tables) and open sheets are left alone.
export function usePullToRefresh() {
  useEffect(() => {
    const ind = document.createElement('div')
    ind.className = 'ptr'
    ind.setAttribute('aria-hidden', 'true')
    // A glass circle: a ring that fills as you pull, with an arrow in the middle that flips up when you can let go
    ind.innerHTML = '<svg class="ptr-ring" viewBox="0 0 40 40"><circle cx="20" cy="20" r="15" class="ptr-track"/><circle cx="20" cy="20" r="15" class="ptr-fill" pathLength="100"/></svg>'
      + '<svg class="ptr-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M6 13l6 6 6-6"/></svg>'
    document.body.append(ind)
    const LIMIT = 72
    let y0: number | null = null, x0 = 0, pull = 0, active = false
    const reset = () => { y0 = null; active = false; pull = 0; ind.classList.remove('armed'); ind.style.transform = ''; ind.style.opacity = ''; ind.style.removeProperty('--p') }
    const start = (e: TouchEvent) => {
      if (!isNarrow() || scrollY > 0 || e.touches.length !== 1 || document.querySelector('dialog[open]') || document.body.classList.contains('search-open')) return
      if ((e.target as Element).closest('.gc-goals, .datetabs, .strip, .tscroll, .chips, input, textarea, select, .smap-stage')) return
      y0 = e.touches[0].clientY; x0 = e.touches[0].clientX
    }
    const move = (e: TouchEvent) => {
      if (y0 == null) return
      const dy = e.touches[0].clientY - y0, dx = e.touches[0].clientX - x0
      if (!active) {
        if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) { reset(); return } // a sideways swipe
        if (dy < 8 || scrollY > 0) return
        active = true
      }
      pull = Math.max(0, Math.min(120, dy * 0.5))
      ind.style.opacity = String(Math.min(1, pull / 40))
      ind.style.transform = `translateY(${pull}px)`
      ind.style.setProperty('--p', String(Math.min(1, pull / LIMIT)))
      ind.classList.toggle('armed', pull >= LIMIT)
    }
    const end = () => {
      if (!active) { reset(); return }
      if (pull >= LIMIT) {
        ind.classList.add('loading'); ind.style.transform = `translateY(${LIMIT}px)`
        setTimeout(() => location.reload(), 250)
        return
      }
      reset()
    }
    addEventListener('touchstart', start, { passive: true })
    addEventListener('touchmove', move, { passive: true })
    addEventListener('touchend', end, { passive: true })
    addEventListener('touchcancel', reset, { passive: true })
    return () => {
      removeEventListener('touchstart', start)
      removeEventListener('touchmove', move)
      removeEventListener('touchend', end)
      removeEventListener('touchcancel', reset)
      ind.remove()
    }
  }, [])
}

// Web app: works offline with the latest data (the service worker, on the published site only), and refreshes
// when reopened after a while: a new version of the site reloads at once, so a home-screen app never keeps an
// old design, and new data reloads after five minutes away
export function useAppMode(updated: string) {
  const loadedAt = useRef(0), checkedAt = useRef(0)
  useEffect(() => {
    if (import.meta.env.PROD && 'serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
      navigator.serviceWorker.register('sw.js').catch(() => {})
    }
  }, [])
  useEffect(() => {
    loadedAt.current = checkedAt.current = Date.now()
    const onVisible = async () => {
      if (document.visibilityState !== 'visible') return
      try {
        const published = (window as { SHL_BUILD?: string }).SHL_BUILD
        if (published && Date.now() - checkedAt.current > 60 * 1000) {
          checkedAt.current = Date.now()
          const html = await (await fetch(`./?check=${Date.now()}`, { cache: 'no-store' })).text()
          const build = html.match(/SHL_BUILD = '([^']+)'/)?.[1]
          if (build && build !== published) { location.reload(); return }
        }
        if (Date.now() - loadedAt.current < 5 * 60 * 1000) return
        loadedAt.current = Date.now()
        const fresh = await (await fetch(`${dataUrl('core.json')}&check=${Date.now()}`, { cache: 'no-store' })).json()
        if (fresh.updated !== updated) location.reload()
      } catch { /* offline: keep showing what we have */ }
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [updated])
}
