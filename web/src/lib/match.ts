// Match calculations: win probability through a game, and the match report (summary text, three stars, key moments)
import { dec, signed } from './format'
import type { GameDetails, GoalEvent, Model } from './types'

export const clockSec = (x: { p: number; t?: string }) => { const [m, s] = String(x.t || '0:0').split(':').map(Number); return (x.p - 1) * 1200 + m * 60 + s }
const whenTxt = (x: GoalEvent) => x.p === 4 ? `i förlängningen (${x.t})` : x.p >= 5 ? 'i straffläggningen' : `i ${['första', 'andra', 'tredje'][x.p - 1]} perioden (${x.t})`
// Swedish genitive: Växjö Lakers, Örebro Hockeys, Frölunda HC:s, HV71:s
const gen = (n: string) => /[sxz]$/.test(n) ? n : /[A-ZÅÄÖ0-9]$/.test(n) ? n + ':s' : n + 's'
const countTxt = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

// Expected goals per team before the game, from the team ratings
export function expectedGoals(m: Model | undefined, home: string, away: string): [number, number] {
  const r = m?.rating || {}
  if (!m || !r[home] || !r[away]) return [1.5, 1.4]
  return [m.L * r[home].att * r[away].def * m.HOME, m.L * r[away].att * r[home].def * m.AWAY]
}

/* Win probability through the game. Each team scores at its pre-game rate (the same team ratings as the pre-game
   win chance), scaled to the time that is left. From the current score, the rest of regulation is two Poisson
   draws; a draw goes to a 5-minute 3-on-3 overtime (sudden death, a bit higher scoring) and then a 50/50 shootout. */
export interface WinPoint { t: number; p: number; goal?: GoalEvent }
export function winSeries(d: GameDetails, m: Model | undefined) {
  const [lh, la] = expectedGoals(m, d.home, d.away)
  const share = lh / (lh + la), otRate = (lh + la) / 3600 * 1.6
  const pois = (l: number) => { const p = [Math.exp(-l)]; for (let k = 1; k <= 10; k++) p.push(p[k - 1] * l / k); return p }
  const otWin = (rem: number) => { const s = 1 - Math.exp(-otRate * rem); return s * share + (1 - s) * 0.5 }
  const at = (t: number, h: number, a: number) => {
    if (t >= 3600) return h !== a ? (h > a ? 1 : 0) : otWin(Math.max(0, 3900 - t))
    const f = (3600 - t) / 3600, ph = pois(lh * f), pa = pois(la * f)
    let win = 0, tie = 0
    ph.forEach((x, i) => pa.forEach((y, j) => { const dh = h + i, da = a + j; if (dh > da) win += x * y; else if (dh === da) tie += x * y }))
    return win + tie * otWin(300)
  }
  const goals = d.goals.filter((x) => x.p < 5).map((x) => ({ ...x, s: clockSec(x) })).sort((x, y) => x.s - y.s)
  const L = d.live, done = !L
  const lastOT = goals.filter((x) => x.p === 4).pop()
  const end = done ? (lastOT ? lastOT.s : d.goals.some((x) => x.p >= 5) ? 3900 : 3600) : Math.min(3900, L?.p ? clockSec({ p: Math.min(L.p, 4), t: L.t }) : 0)
  const score = (t: number, incl: boolean) => goals.reduce(([h, a], x) => (incl ? x.s <= t : x.s < t) ? (x.team === 'home' ? [h + 1, a] : [h, a + 1]) : [h, a], [0, 0])
  const pts: WinPoint[] = []
  for (let t = 0; t < end; t += 30) pts.push({ t, p: at(t, ...score(t, true) as [number, number]) })
  for (const x of goals) if (x.s <= end) pts.push({ t: x.s, p: at(x.s, ...score(x.s, false) as [number, number]) }, { t: x.s + 0.01, p: at(x.s, ...score(x.s, true) as [number, number]), goal: x })
  pts.sort((x, y) => x.t - y.t)
  // The final word: a finished game ends at 100 % for the winner (shootouts included)
  pts.push({ t: end, p: done ? (d.hs! > d.as! ? 1 : d.hs! < d.as! ? 0 : 0.5) : at(end, ...score(end, true) as [number, number]) })
  return { pts, end, now: pts[pts.length - 1].p }
}

type Side = 'home' | 'away'
type SkRow = GameDetails['box']['home'][number] & { side: Side; team: string }
type GkRowS = GameDetails['gk']['home'][number] & { side: Side; team: string }
export interface Facts {
  winSide: Side; loseSide: Side; W: string; L: string; w: number; l: number; goals: GoalEvent[]; so: GoalEvent[]
  worst: number; worstAt: [number, number] | null; changes: number; alwaysAhead: boolean; gwg: GoalEvent | null; sk: SkRow[]; gks: GkRowS[]
}

export function recapFacts(d: GameDetails): Facts {
  const winSide: Side = d.hs! > d.as! ? 'home' : 'away', loseSide: Side = winSide === 'home' ? 'away' : 'home'
  const w = Math.max(d.hs!, d.as!), l = Math.min(d.hs!, d.as!)
  const goals = d.goals.filter((x) => x.p < 5), so = d.goals.filter((x) => x.p >= 5)
  // Score progression, seen from the winner
  let worst = 0, worstAt: [number, number] | null = null, changes = 0, leader: Side | null = null, alwaysAhead = true
  for (const x of goals) {
    const [h, a] = x.score, diff = winSide === 'home' ? h - a : a - h
    if (-diff > worst) { worst = -diff; worstAt = x.score }
    if (diff <= 0) alwaysAhead = false
    const now: Side | null = h > a ? 'home' : a > h ? 'away' : null
    if (now && leader && now !== leader) changes++
    if (now) leader = now
  }
  // Game-winning goal: the winner's goal that put them one ahead of the loser's final total
  let n = 0, gwg: GoalEvent | null = null
  for (const x of goals) if (x.team === winSide && ++n === l + 1) gwg = x
  if (d.so) gwg = [...so].reverse().find((x) => x.team === winSide) || null
  const box = (side: Side) => (d.box[side] || []).map((r) => ({ ...r, side, team: d[side] }))
  const sk = [...box('home'), ...box('away')]
  const gks = (['home', 'away'] as const).flatMap((side) => (d.gk[side] || []).filter((r) => r.soga > 0).map((r) => ({ ...r, side, team: d[side] })))
  return { winSide, loseSide, W: d[winSide], L: d[loseSide], w, l, goals, so, worst, worstAt, changes, alwaysAhead, gwg, sk, gks }
}

export function threeStars(F: Facts) {
  const rated = [
    ...F.sk.map((r) => ({ ...r, kind: 'sk' as const, score: r.g * 3 + r.a * 2 + (r.pm || 0) * 0.5 + (r.sog || 0) * 0.15 + (F.gwg?.scorer?.id && F.gwg.scorer.id === r.id ? 1 : 0) })),
    // Goalies: saves above a league-average goalie (90.5 %) count most, plus a bonus for a shutout, the win and a busy night,
    // so a strong game in net competes with a goal and an assist
    ...F.gks.map((r) => ({ ...r, kind: 'gk' as const, score: (r.svs - r.soga * 0.905) * 2.2 + (r.ga === 0 && r.soga >= 15 ? 4 : 0) + (r.side === F.winSide ? 1.5 : 0) + r.soga * 0.04 })),
  ].filter((r) => r.name).sort((a, b) => b.score - a.score)
  return rated.slice(0, 3).map((r) => ({
    id: r.id, name: r.name, team: r.team,
    line: r.kind === 'gk'
      ? `${r.svs} räddningar · ${dec(r.svs / r.soga * 100, 1)} %${r.ga === 0 ? ' · nolla' : ''}`
      : [r.g ? countTxt(r.g, 'mål', 'mål') : '', r.a ? countTxt(r.a, 'assist', 'assist') : ''].filter(Boolean).join(', ') || `${r.sog || 0} skott, ${signed(r.pm || 0)}`,
  }))
}

export function recapText(d: GameDetails, F: Facts, nm: (c: string) => string) {
  const where = F.winSide === 'home' ? 'hemma' : 'borta'
  const s: string[] = []
  // 1. The result
  if (d.so || d.ot) s.push(`${nm(F.W)} vann ${where} mot ${nm(F.L)} med ${F.w}–${F.l} efter ${d.so ? 'straffläggning' : 'förlängning'}.`)
  else if (F.w - F.l >= 3) s.push(`${nm(F.W)} tog en klar ${where}seger mot ${nm(F.L)} och vann med ${F.w}–${F.l}.`)
  else s.push(`${nm(F.W)} vann ${where} mot ${nm(F.L)} med ${F.w}–${F.l}${F.w + F.l >= 9 ? ' i en målrik match' : F.w - F.l === 1 ? ' efter en jämn match' : ''}.`)
  // 2. How it went
  if (F.worst >= 2 && F.worstAt) s.push(`${nm(F.W)} låg under med ${F.winSide === 'home' ? F.worstAt.join('–') : [...F.worstAt].reverse().join('–')} men vände matchen.`)
  else if (F.changes >= 2) s.push(`Ledningen bytte lag ${F.changes} gånger.`)
  else if (F.alwaysAhead && F.goals.length && F.goals[0].team === F.winSide && F.w - F.l >= 2) s.push(`${nm(F.W)} gjorde första målet ${whenTxt(F.goals[0])} och släppte aldrig ledningen.`)
  // 3. The decider, told together with a late equaliser from the losing side when there was one
  const who = F.gwg?.scorer?.name
  const lateTie = [...F.goals].reverse().find((x) => x.p === 3 && x.team === F.loseSide && x.score[0] === x.score[1])
  if (d.so) s.push(who ? `${who} satte det avgörande straffslaget.` : 'Matchen avgjordes i straffläggningen.')
  else if (who && F.gwg && lateTie && clockSec(lateTie) < clockSec(F.gwg)) {
    const gap = clockSec(F.gwg) - clockSec(lateTie)
    const later = F.gwg.p !== lateTie.p ? whenTxt(F.gwg) : gap < 60 ? `bara ${gap} sekunder senare` : gap < 90 ? 'en minut senare' : `${Math.round(gap / 60)} minuter senare`
    s.push(`${nm(F.L)} kvitterade till ${lateTie.score.join('–')} ${whenTxt(lateTie)}, men ${who} avgjorde ${later}.`)
  }
  else if (d.ot && who && F.gwg) s.push(`${who} avgjorde ${whenTxt(F.gwg)}.`)
  else if (who && F.gwg && F.w - F.l <= 2) s.push(`Det matchavgörande målet gjorde ${who} ${whenTxt(F.gwg)}.`)
  // 4. Standout skaters: hat-tricks, then the top point scorer
  const hat = F.sk.filter((r) => r.g >= 3)
  for (const r of hat) s.push(`${r.name} gjorde ${r.g === 3 ? 'hattrick' : `${r.g} mål`} för ${nm(r.team)}${r.a ? ` och hade dessutom ${countTxt(r.a, 'assist', 'assist')}` : ''}.`)
  const top = [...F.sk].sort((a, b) => (b.g + b.a) - (a.g + a.a) || b.g - a.g)[0]
  if (top && !hat.includes(top) && top.g + top.a >= 3) s.push(`${top.name} var matchens poängkung med ${[top.g ? countTxt(top.g, 'mål', 'mål') : '', top.a ? countTxt(top.a, 'assist', 'assist') : ''].filter(Boolean).join(' och ')}.`)
  // 5. Chances (xG)
  if (d.xg) {
    const xw = d.xg[F.winSide === 'home' ? 0 : 1], xl = d.xg[F.winSide === 'home' ? 1 : 0]
    if (Math.abs(xw - xl) < 0.3) s.push(`Chanserna var jämnt fördelade enligt xG, ${dec(xw, 1)}–${dec(xl, 1)}.`)
    else if (xw > xl) s.push(`${nm(F.W)} skapade också de farligaste chanserna, ${dec(xw, 1)}–${dec(xl, 1)} i xG.`)
    else s.push(`${nm(F.L)} skapade egentligen mer enligt xG (${dec(xl, 1)}–${dec(xw, 1)}), men ${nm(F.W)} var effektivare framför mål.`)
  }
  // 6. The winning goalie when he stood out; the losing one only after a big night in a close game
  const gk = [...F.gks].filter((r) => r.soga >= 15 && (r.side === F.winSide ? r.ga === 0 || r.svs / r.soga >= 0.93 : r.soga >= 30 && r.svs / r.soga >= 0.95 && F.w - F.l <= 1))
    .sort((a, b) => Number(b.side === F.winSide) - Number(a.side === F.winSide) || (b.svs / b.soga) - (a.svs / a.soga))[0]
  if (gk) s.push(`${gk.name} i ${gen(nm(gk.team))} mål räddade ${gk.svs} av ${gk.soga} skott${gk.ga === 0 ? ' och höll nollan' : ''}.`)
  return s
}

export function keyMoments(d: GameDetails, F: Facts): [GoalEvent, string[]][] {
  const m = new Map<GoalEvent, string[]>() // goal → labels
  const add = (x: GoalEvent | null | undefined, label: string) => { if (!x) return; const e = m.get(x) || []; if (!e.includes(label)) e.push(label); m.set(x, e) }
  if (F.goals[0]) add(F.goals[0], 'Första målet')
  const tally: Record<string, number> = {}
  for (const [i, x] of F.goals.entries()) {
    const [h, a] = x.score
    if (h === a && x.p >= 3) add(x, 'Kvittering')
    const who = x.scorer?.name
    if (who && (tally[who] = (tally[who] || 0) + 1) === 3) add(x, 'Hattrick')
    const prev = F.goals[i - 1]
    if (prev && prev.team === x.team && clockSec(x) - clockSec(prev) <= 60) add(x, `Två mål på ${clockSec(x) - clockSec(prev)} sek`)
  }
  if (F.worst >= 2) { // the goal that started the comeback
    const low = F.goals.findIndex((y) => y.score === F.worstAt)
    add(F.goals.slice(low + 1).find((x) => x.team === F.winSide), 'Vändningen börjar')
  }
  if (d.so) add(F.gwg, 'Avgörande straff')
  else if (d.ot) add(F.gwg, 'Avgjorde i förlängningen')
  else add(F.gwg, 'Matchavgörande')
  return [...m].sort((a, b) => clockSec(a[0]) - clockSec(b[0])).slice(-6)
}

// Penalty codes in plain words
export const OFFENCE: Record<string, string> = {
  HOOK: 'Hooking', TRIP: 'Tripping', SLASH: 'Slashing', ROUGH: 'Roughing', HOLD: 'Holding', 'HO-ST': 'Holding the stick',
  INTRF: 'Interference', INTERF: 'Interference', 'TOO-M': 'Too many men', 'HI-ST': 'High-sticking', CROSS: 'Cross-checking',
  BOARD: 'Boarding', CHARG: 'Charging', DIV: 'Diving', ELBOW: 'Elbowing', 'DE-GA': 'Delay of game', DELAY: 'Delay of game',
  UNSP: 'Unsportsmanlike conduct', 'UN-SP': 'Unsportsmanlike conduct', FIGHT: 'Fighting', KNEE: 'Kneeing', 'HE-CO': 'Check to the head',
  'CH-HE': 'Check to the head', 'CH-BE': 'Checking from behind', SPEAR: 'Spearing', KICK: 'Kicking', 'IL-EQ': 'Illegal equipment',
  'BR-ST': 'Broken stick', THROW: 'Throwing the stick', 'CL-FA': 'Closing hand on puck', 'HA-PA': 'Hand pass', 'LE-BE': 'Leaving the bench',
}
