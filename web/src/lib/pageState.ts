import { useCallback, useState } from 'react'

// State that outlives the page: a filter or open card is still as you left it when you come back while browsing
const kept = new Map<string, unknown>()

export function useKeptState<T>(key: string, init: T | (() => T)) {
  const [v, setV] = useState<T>(() => (kept.has(key) ? kept.get(key) as T : typeof init === 'function' ? (init as () => T)() : init))
  const set = useCallback((next: T) => { kept.set(key, next); setV(next) }, [key])
  return [v, set] as const
}
