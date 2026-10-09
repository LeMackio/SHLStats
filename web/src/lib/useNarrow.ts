import { useSyncExternalStore } from 'react'

// Phones (below 700 px) get their own layouts and charts drawn at the screen's real width.
// Components re-render when the window crosses the breakpoint or, for widths, when it resizes.
const subscribe = (cb: () => void) => {
  window.addEventListener('resize', cb)
  return () => window.removeEventListener('resize', cb)
}

export const useNarrow = () => useSyncExternalStore(subscribe, () => window.innerWidth < 700)

// The width a chart is drawn at: its normal width on computers, the screen width on phones
export function useChartWidth(w: number) {
  const narrow = useNarrow()
  const vw = useSyncExternalStore(subscribe, () => (window.innerWidth < 700 ? window.innerWidth : 0))
  return narrow ? Math.max(300, Math.min(w, vw - 40)) : w
}
