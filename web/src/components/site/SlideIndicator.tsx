import { useLayoutEffect, useRef } from 'react'

// Sliding highlight: in menus, toggles and tabs the highlight glides to the chosen option instead of jumping.
// Render it as the first child of the group (which needs the "has-ind" class) and pass the selector of the
// chosen item. When a group is drawn anew, it starts where the old one with the same key was, so the slide still shows.
const LAST = new Map<string, Rect>()
type Rect = { x: number; y: number; w: number; h: number }

export function SlideIndicator({ kind, active, groupKey, dep }: {
  kind: 'pill' | 'line'
  active: string // selector of the chosen item among the group's children, e.g. '.on' or '[aria-pressed="true"]'
  groupKey: string // identifies the group across redraws
  dep?: unknown // anything whose change moves the selection
}) {
  const ref = useRef<HTMLSpanElement>(null)

  useLayoutEffect(() => {
    const ind = ref.current, box = ind?.parentElement
    if (!ind || !box) return
    const place = (p: Rect) => {
      ind.style.width = `${p.w}px`
      if (kind === 'pill') { ind.style.height = `${p.h}px`; ind.style.transform = `translate(${p.x}px, ${p.y}px)` }
      else ind.style.transform = `translateX(${p.x}px)`
    }
    const sync = () => {
      const on = [...box.children].find((el) => el !== ind && el.matches(active)) as HTMLElement | undefined
      if (!on || !on.offsetWidth) { ind.style.opacity = '0'; return }
      const r = { x: on.offsetLeft, y: on.offsetTop, w: on.offsetWidth, h: on.offsetHeight }
      if (!ind.dataset.ready) {
        const prev = LAST.get(groupKey)
        if (prev && (prev.x !== r.x || prev.w !== r.w)) { place(prev); void ind.offsetWidth; ind.dataset.ready = '1' }
        else requestAnimationFrame(() => { ind.dataset.ready = '1' }) // first time: appear in place, no slide in from the side
      }
      ind.style.opacity = '1'
      place(r)
      LAST.set(groupKey, r)
    }
    sync()
    // Follow the group when it changes size (fonts loading, the phone menu shrinking, window resizes)
    const ro = new ResizeObserver(sync)
    ro.observe(box)
    document.fonts?.ready.then(sync)
    return () => ro.disconnect()
  }, [kind, active, groupKey, dep])

  return <span ref={ref} className={`sl-ind sl-${kind}`} aria-hidden="true" />
}
