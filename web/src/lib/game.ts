import { fmtTime } from './format'
import { isFinal, isLive, type Game } from './types'

// "Slut", "Slut/ÖT", "Live" or the face-off time
export const statusTxt = (g: Game) => isFinal(g) ? (g.so ? 'Slut/str' : g.ot ? 'Slut/ÖT' : 'Slut') : isLive(g) ? 'Live' : fmtTime(g.start)

// Result for a team in a finished game: v (win), ov (OT/SO win), of (OT/SO loss), f (loss)
export const resultFor = (g: Game, code: string) => {
  const home = g.home === code, mine = (home ? g.hs : g.as)!, theirs = (home ? g.as : g.hs)!, extra = g.ot || g.so
  return mine > theirs ? (extra ? 'ov' : 'v') : (extra ? 'of' : 'f')
}

// Swedish ordinals: 1:a, 2:a, 3:e … 21:a, 22:a
export const ordinal = (n: number) => `${n}:${[1, 2].includes(n % 10) && ![11, 12].includes(n % 100) ? 'a' : 'e'}`

export const safeUrl = (u?: string | null) => { try { const x = new URL(u || ''); return x.protocol === 'https:' ? x.href : null } catch { return null } }

// Only SHL's video host is ever embedded
export const safeEmbed = (url?: string | null) => {
  try { const u = new URL(url || ''); return u.protocol === 'https:' && /(^|\.)staylive\.tv$/.test(u.hostname) ? u.href : null } catch { return null }
}
