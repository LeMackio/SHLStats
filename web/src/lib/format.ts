// Number, date and name formatting, the same as the original site (Swedish conventions)

export const dec = (x: number | null | undefined, n = 1) => (x == null || !isFinite(x)) ? '–' : x.toFixed(n).replace('.', ',')
export const pctTxt = (p: number | null | undefined, n = 0) => (p == null || !isFinite(p)) ? '–' : dec(p * 100, n) + ' %'
export const oddsTxt = (p: number | null | undefined) =>
  p == null ? '–' : p >= 0.995 ? '>99 %' : p <= 0 ? '–' : p < 0.005 ? '<1 %' : Math.round(p * 100) + ' %'
export const signed = (v: number) => v > 0 ? '+' + v : String(v)
export const mmss = (s: number | null | undefined) => s ? `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}` : '–'

export const MONTHS = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec']
export const DAYS = ['sön', 'mån', 'tis', 'ons', 'tor', 'fre', 'lör']
export const DAYS_LONG = ['Söndag', 'Måndag', 'Tisdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lördag']

export const dateParts = (s: string) => {
  const [y, m, d] = s.slice(0, 10).split('-').map(Number)
  return { y, m, d, wd: new Date(y, m - 1, d).getDay() }
}
export const fmtDay = (s: string) => { const p = dateParts(s); return `${DAYS[p.wd]} ${p.d} ${MONTHS[p.m - 1]}` }
export const fmtDate = (s: string) => { const p = dateParts(s); return `${p.d} ${MONTHS[p.m - 1]} ${p.y}` }
export const fmtTime = (s: string) => s.slice(11, 16)
export const todayStr = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Stockholm' })

export const ageOf = (born?: string | null) => {
  if (!born) return '–'
  const b = new Date(born), n = new Date()
  let a = n.getFullYear() - b.getFullYear()
  if (n < new Date(n.getFullYear(), b.getMonth(), b.getDate())) a--
  return a
}
export const initials = (name?: string | null) =>
  String(name || '').split(/\s+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join('')
export const normName = (s?: string | null) =>
  String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
export const sum = (a: number[]) => a.reduce((s, x) => s + x, 0)

// Game start times are Stockholm local time; convert to a real timestamp (handles summer/winter time)
export const stockholmEpoch = (s: string) => {
  const [d, tm = '00:00'] = s.split(' ')
  const [y, m, dd] = d.split('-').map(Number), [h, mi] = tm.split(':').map(Number)
  const guess = Date.UTC(y, m - 1, dd, h, mi)
  const asStockholm = new Date(new Date(guess).toLocaleString('en-US', { timeZone: 'Europe/Stockholm' }))
  const asUtc = new Date(new Date(guess).toLocaleString('en-US', { timeZone: 'UTC' }))
  return guess - (asStockholm.getTime() - asUtc.getTime())
}

export const isNarrow = () => window.innerWidth < 700

export const store = {
  get: (k: string) => { try { return localStorage.getItem(k) } catch { return null } },
  set: (k: string, v: string | null) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v) } catch { /* private mode */ } },
}

export const POS: Record<string, string> = { D: 'Back', LD: 'Back', RD: 'Back', CE: 'Center', C: 'Center', LW: 'Forward', RW: 'Forward', F: 'Forward', GK: 'Målvakt' }
export const POS_SHORT: Record<string, string> = { D: 'B', LD: 'B', RD: 'B', CE: 'C', C: 'C', LW: 'VF', RW: 'HF', F: 'F', GK: 'MV' }
export const posGroup = (p: string) => p === 'GK' ? 'G' : ['D', 'LD', 'RD'].includes(p) ? 'D' : 'F'
