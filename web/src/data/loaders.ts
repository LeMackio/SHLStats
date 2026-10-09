import { useEffect, useState } from 'react'
import type { MediaData, PlayersData, TeamsData } from '@/lib/types'
import { dataUrl } from './context'

// The bigger data files load the first time a page needs them, then stay in memory
function cachedJson<T>(path: string) {
  let value: T | undefined, pending: Promise<T> | undefined
  const load = () => (pending ??= fetch(dataUrl(path)).then((r) => {
    if (!r.ok) throw new Error(String(r.status))
    return r.json() as Promise<T>
  }).then((v) => (value = v), (e) => { pending = undefined; throw e }))
  return { load, peek: () => value }
}

export const playersFile = cachedJson<PlayersData>('players.json')
export const teamsFile = cachedJson<TeamsData>('teams.json')
export const mediaFile = cachedJson<MediaData>('media.json')

type File<T> = { load: () => Promise<T>; peek: () => T | undefined }
export type Loaded<T> = { state: 'loading' } | { state: 'error' } | { state: 'ready'; data: T }

// The file's contents, loading it if needed (instantly ready when it is already in memory)
export function useFile<T>(file: File<T>): Loaded<T> {
  const [v, setV] = useState<Loaded<T>>(() => {
    const d = file.peek()
    return d ? { state: 'ready', data: d } : { state: 'loading' }
  })
  useEffect(() => {
    if (file.peek()) return
    let off = false
    file.load().then((data) => { if (!off) setV({ state: 'ready', data }) }, () => { if (!off) setV({ state: 'error' }) })
    return () => { off = true }
  }, [file])
  return v
}
