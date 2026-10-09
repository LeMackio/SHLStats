import { fmtTime } from './format'
import { isFinal, isLive, type Game } from './types'

// "Slut", "Slut/ÖT", "Live" or the face-off time
export const statusTxt = (g: Game) => isFinal(g) ? (g.so ? 'Slut/str' : g.ot ? 'Slut/ÖT' : 'Slut') : isLive(g) ? 'Live' : fmtTime(g.start)

// Only SHL's video host is ever embedded
export const safeEmbed = (url?: string | null) => {
  try { const u = new URL(url || ''); return u.protocol === 'https:' && /(^|\.)staylive\.tv$/.test(u.hostname) ? u.href : null } catch { return null }
}
