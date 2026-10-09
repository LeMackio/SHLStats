import type { GoalEvent, Goalie, Season } from './types'
import { sum } from './format'

// Goalies need this many games to count in the leader lists: 30 % of the most games anyone has played
export const goalieMinGp = (goalies: Goalie[]) => Math.max(1, Math.round(Math.max(0, ...goalies.map((g) => g.gpi)) * 0.3))

// League save percentage, and saves above what an average SHL goalie would have made (goals saved above average)
export const lgSv = (goalies: Goalie[]) => {
  const sv = sum(goalies.map((g) => g.sv)), ga = sum(goalies.map((g) => g.ga))
  return sv / Math.max(1, sv + ga)
}
export const gsaa = (g: Goalie, season: Season) => g.sv - (g.sv + g.ga) * lgSv(season.goalies)

// "Lucas Elvenes" → "L. Elvenes" (phones)
export const shortName = (n?: string | null) => {
  const p = String(n || '').trim().split(/\s+/)
  return p.length > 1 ? `${p[0][0]}. ${p.slice(1).join(' ')}` : String(n || '')
}

// Placement colours: white for the playoff places (a little dimmer for play in), grey outside, red for SHL-kval
export const rankZone = (r: number) =>
  r <= 6 ? 'var(--text)' : r <= 10 ? 'color-mix(in srgb, var(--text) 62%, transparent)' : r >= 13 ? 'var(--bad)' : 'var(--faint)'
export const zoneBad = (n: number) => n >= 13 ? rankZone(n) : 'inherit'

export const strengthTag = (g: GoalEvent) => g.ps ? 'STRAFF' : g.en ? 'TOM KASSE' : /^PP/.test(g.str || '') ? 'PP' : /^(SH|BP)/.test(g.str || '') ? 'BP' : ''
