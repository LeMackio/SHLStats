// Club colours and the colour maths that keeps them readable on every theme

// Approximate club colours for badge fallbacks and tints: [background, text]
export const TC: Record<string, [string, string]> = {
  BIF: ['#e9a900', '#111'], DIF: ['#0b2d6b', '#fff'], FBK: ['#f3c316', '#10220f'], FHC: ['#0f6b3f', '#fff'],
  HV71: ['#1545a3', '#ffd400'], IFB: ['#11804a', '#fff'], LHC: ['#0a5bb4', '#fff'], LHF: ['#b3122f', '#fff'],
  MIF: ['#d31c35', '#fff'], OHK: ['#1d2330', '#fff'], RBK: ['#1a8a3e', '#fff'], SAIK: ['#1b1b1b', '#f5c400'],
  TIK: ['#b8233a', '#fff'], VLH: ['#1c3968', '#f28c28'], LIF: ['#1a4fa0', '#fff'], IKO: ['#e2231a', '#fff'], MODO: ['#b01f2e', '#fff'],
}
export const tColor = (c: string) => (TC[c] || ['#5b6b7e'])[0]

export const hexToRgb = (h: string): [number, number, number] => {
  let s = String(h).replace('#', '')
  if (s.length === 3) s = [...s].map((c) => c + c).join('')
  const n = parseInt(s, 16)
  return [n >> 16 & 255, n >> 8 & 255, n & 255]
}
export const lum = (h: string) => {
  const c = hexToRgb(h).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 })
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
}
export const contrast = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05) }
export const mixHex = (a: string, b: string, t: number) =>
  '#' + hexToRgb(a).map((v, i) => Math.round(v + (hexToRgb(b)[i] - v) * t).toString(16).padStart(2, '0')).join('')

// Hue, saturation and lightness (0–1) to and from hex
const toHsl = (hex: string) => {
  const [r, g, b] = hexToRgb(hex).map((v) => v / 255), mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, dd = mx - mn
  const s = dd ? dd / (1 - Math.abs(2 * l - 1)) : 0
  const h = dd === 0 ? 0 : mx === r ? ((g - b) / dd + 6) % 6 : mx === g ? (b - r) / dd + 2 : (r - g) / dd + 4
  return { h, s, l, dd }
}
const fromHsl = (h: number, s: number, l: number) => {
  const C = (1 - Math.abs(2 * l - 1)) * s, X = C * (1 - Math.abs((h % 2) - 1)), m = l - C / 2
  const [R, G, B] = [[C, X, 0], [X, C, 0], [0, C, X], [0, X, C], [X, 0, C], [C, 0, X]][Math.floor(h) % 6]
  return '#' + [R, G, B].map((v) => Math.round(Math.min(1, Math.max(0, v + m)) * 255).toString(16).padStart(2, '0')).join('')
}
const hasHue = ({ s, dd }: { s: number; dd: number }) => s >= 0.2 && dd >= 0.12 // false for black, white and greys

// A club colour made vivid for big coloured backgrounds: full saturation and a lightness where white text still reads well
export const vivid = (hex: string) => {
  const c = toHsl(hex)
  if (!hasHue(c)) return hex
  return fromHsl(c.h, Math.max(c.s, 0.78), Math.min(0.44, Math.max(0.34, c.l)))
}
// The colour that stands for a club in charts and highlights: its main colour, or its second when the main one is black or grey
export const teamHue = (code: string) => {
  const [a, b] = TC[code] || ['#5b6b7e']
  return hasHue(toHsl(a)) || !b || !hasHue(toHsl(b)) ? a : b
}
export const colorDist = (a: string, b: string) => {
  const [r1, g1, b1] = hexToRgb(a), [r2, g2, b2] = hexToRgb(b), rm = (r1 + r2) / 2
  return Math.sqrt((2 + rm / 256) * (r1 - r2) ** 2 + 4 * (g1 - g2) ** 2 + (2 + (255 - rm) / 256) * (b1 - b2) ** 2)
}
// A club colour that reads on the current cards: coloured clubs keep their hue and only the lightness moves
export const readable = (c: string) => {
  const panel = getComputedStyle(document.documentElement).getPropertyValue('--panel').trim() || '#212934'
  const dark = lum(panel) < 0.2, base = toHsl(c)
  if (!hasHue(base)) {
    let x = c
    for (let i = 0; i < 5 && contrast(x, panel) < 2.4; i++) x = mixHex(x, dark ? '#ffffff' : '#000000', 0.22)
    return x
  }
  const v = toHsl(vivid(c))
  let l = v.l, x = fromHsl(v.h, v.s, l)
  for (let i = 0; i < 8 && contrast(x, panel) < 2.6; i++) { l = Math.min(0.78, Math.max(0.18, l + (dark ? 0.05 : -0.05))); x = fromHsl(v.h, Math.min(1, v.s), l) }
  return x
}
// Two team colours that can be told apart: if too alike, the away side switches to its second colour or a neutral
export function pairColors(h: string, a: string): [string, string] {
  const hc = readable(teamHue(h))
  let ac = readable(teamHue(a))
  if (colorDist(hc, ac) < 150) {
    const alt = (TC[a] || [])[1], altR = alt && hasHue(toHsl(alt)) ? readable(alt) : null
    ac = altR && colorDist(hc, altR) >= 150 ? altR : colorDist(hc, '#8fa3b8') >= 150 ? '#8fa3b8' : '#e3b75a'
  }
  return [hc, ac]
}
export function teamAccent(code: string) {
  if (!TC[code]) return null
  const pick = readable(teamHue(code))
  return { accent: pick, ink: lum(pick) > 0.35 ? '#10151c' : '#ffffff' }
}

// Win-probability pill tint: the accent for the favourite, red for the underdog
export const pillStyle = (p: number) => {
  const hue = p >= 0.5 ? 'var(--accent)' : 'var(--bad)'
  return { background: `color-mix(in srgb, ${hue} ${Math.round(18 + Math.abs(p - 0.5) * 90)}%, transparent)` }
}
