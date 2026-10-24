import { useEffect, useRef, useState, type ReactNode } from 'react'
import { dataUrl, useData } from '@/data/context'
import { ageOf, fmtDay, initials, normName, POS_SHORT } from '@/lib/format'
import { resultFor, safeEmbed, safeUrl } from '@/lib/game'
import { MIN_GP, METRICS, type Card } from '@/lib/cards'
import { shortName } from '@/lib/stats'
import { readable, TC, tColor, teamHue } from '@/lib/teams'
import { useTheme } from '@/lib/theme'
import { isFinal, type Clip, type Lineup, type LineupPlayer, type NewsItem, type TeamNews } from '@/lib/types'
import { useNarrow } from '@/lib/useNarrow'
import { Empty } from './Panel'
import { CleanImg } from './Portrait'
import pcard from './PlayerCard.module.css'
import { Avatar, PlayerLink, TeamBadge } from './TeamBadge'

const durTxt = (s?: number) => s ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : ''

// A video as a card with its thumbnail; clicking opens the player (see VideoDialog)
export function ClipCard({ c, title, sub, big = false }: { c: Clip | null | undefined; title: ReactNode; sub?: ReactNode; big?: boolean }) {
  if (!c || !safeEmbed(c.embed)) return null
  return (
    <button className={`clip ${big ? 'big' : ''}`} data-embed={c.embed} data-title={typeof title === 'string' ? title : undefined}>
      <span className="thumb">{c.thumb && <img src={c.thumb} alt="" loading="lazy" />}<span className="play-ic" />{c.dur ? <span className="dur">{durTxt(c.dur)}</span> : null}</span>
      <span className="ct">{title}</span>{sub && <span className="cs">{sub}</span>}
    </button>
  )
}

// The last games as small result tiles: the opponent's logo and the score seen from this team (4–2), tinted green
// for a win and red for a loss (lighter after overtime or a shootout). Oldest first.
export function FormChips({ code, n = 5 }: { code: string; n?: number }) {
  const { games, tName } = useData()
  const last = games.filter((g) => isFinal(g) && (g.home === code || g.away === code)).slice(-n)
  if (!last.length) return <span className="faint">Inga matcher än</span>
  const map = { v: ['w', 'Vinst'], ov: ['o', 'Vinst efter övertid/straffar'], of: ['ol', 'Förlust efter övertid/straffar'], f: ['l', 'Förlust'] }
  return (
    <div className="fm-row">
      {last.map((g) => {
        const [c, tt] = map[resultFor(g, code)], home = g.home === code, opp = home ? g.away : g.home, mine = home ? g.hs : g.as, theirs = home ? g.as : g.hs
        return (
          <a key={g.id} className={`fm fm-${c}`} href={`#/match/${g.id}`} title={`${tt} ${home ? 'hemma' : 'borta'} mot ${tName(opp)}, ${mine}–${theirs}${g.so ? ' efter straffar' : g.ot ? ' efter övertid' : ''}`}>
            <TeamBadge code={opp} /><b className="num">{mine}–{theirs}</b>
          </a>
        )
      })}
    </div>
  )
}

// A numbered top list of players: rank, team logo, headshot, name (and a small second line), value
export function LeaderList<T extends { id: string; name: string; team: string }>({ rows, val, fmt = (v) => String(v), team = (r) => r.team, n = 10, sub, avatars = true, logos = true }: {
  rows: T[]
  val: (r: T) => unknown
  fmt?: (v: never) => ReactNode
  team?: (r: T) => string
  n?: number
  sub?: (r: T) => ReactNode
  avatars?: boolean
  logos?: boolean
}) {
  if (!rows.length) return <Empty>Ingen statistik ännu.</Empty>
  return (
    <ol className={`lb ${avatars ? '' : 'noav'} ${logos ? '' : 'nologo'}`}>
      {rows.slice(0, n).map((r, i) => (
        <li key={r.id}>
          <span className="r num">{i + 1}</span>
          {logos && <TeamBadge code={team(r)} size={avatars ? '' : 'md'} />}
          {avatars && <Avatar id={r.id} name={r.name} team={team(r)} />}
          <span className="n"><PlayerLink id={r.id} name={r.name} />{sub && <small>{sub(r)}</small>}</span>
          <span className="v">{fmt(val(r) as never)}</span>
        </li>
      ))}
    </ol>
  )
}

// Desktop top card for player and team pages, laid out like a broadcast profile: a thin first line and a big
// uppercase name with a badge and a button, large numbers, a short facts list, a big photo on the right over a
// blurred copy of it, and a stats band along the bottom
export interface RefRow { label: string; cells: [string, ReactNode][] }
export function RefHero({ bg, mark, tc, photo, photoCls = '', first, last, badge, action, big = [], facts = [], rows = [], tabs }: {
  bg?: string
  mark?: string // team code: its logo drawn as outlines behind the name
  tc?: string
  photo?: string
  photoCls?: string
  first?: ReactNode // a player's first name above the last name (teams have only the name)
  last: string
  badge?: ReactNode
  action?: ReactNode
  big?: [string, ReactNode, string?][]
  facts?: [string, ReactNode][]
  rows?: RefRow[]
  tabs?: ReactNode
}) {
  const narrow = useNarrow()
  // A row's column names only show when they differ from the row above
  const keysOf = (r: RefRow) => r.cells.map(([k]) => k).join('|')
  return (
    <section className={`ref ${tc ? 'ref-tinted' : ''}`} style={tc ? ({ '--tc': tc } as React.CSSProperties) : undefined}>
      {/* The background, in the style of NHL.com: the team colour fading to black over a fine mesh, with the club logo
          large behind everything, drawn only as outlines in a light tint of the team colour. The logos are pictures, so
          the outlines come from an SVG filter: edge detection for the lines inside the logo, plus a ring around its shape. */}
      {bg && <>
        <svg className="ref-defs" aria-hidden="true" focusable="false">
          <filter id="ref-outline" x="-2%" y="-2%" width="104%" height="104%" colorInterpolationFilters="sRGB">
            <feConvolveMatrix in="SourceGraphic" order="3" kernelMatrix="-1 -1 -1 -1 8 -1 -1 -1 -1" preserveAlpha="true" result="edges" />
            <feColorMatrix in="edges" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  2.2 2.2 2.2 0 0" result="lines" />
            <feMorphology in="SourceAlpha" operator="dilate" radius="1.6" result="grown" />
            <feComposite in="grown" in2="SourceAlpha" operator="out" result="ring" />
            <feMerge result="all"><feMergeNode in="lines" /><feMergeNode in="ring" /></feMerge>
            <feFlood className="ref-outline-ink" />
            <feComposite in2="all" operator="in" />
          </filter>
        </svg>
        <div className="ref-bg" />
        {mark ? <OutlineLogo code={mark} fallback={bg} /> : <img className="ref-mark" src={bg} alt="" />}
      </>}
      {/* Phones: a player's studio background is removed so the player stands on the card */}
      {photo && <RefPhoto src={photo} cls={photoCls} clean={narrow && !photoCls} />}
      {action && <div className="ref-action">{action}</div>}
      <div className="ref-main"><div className="ref-left">
        {first && <div className="ref-first">{first}</div>}
        <div className="ref-namerow">
          <h1 className="ref-last" style={{ '--w': Math.max(...String(last).split(/\s+/).map((x) => x.length)) } as React.CSSProperties}>{last}</h1>
          {badge && <span className="ref-badge">{badge}</span>}
        </div>
        <span className="ref-rule" />
        {big.length > 0 && <>
          <div className="ref-big">{big.map(([k, v, unit]) => <div key={k}><span>{k}</span><b className="num">{v}{unit && <small>{unit}</small>}</b></div>)}</div>
          <span className="ref-rule" />
        </>}
        {facts.length > 0 && <dl className="ref-facts">{facts.map(([k, v]) => <FactRow key={k} k={k} v={v} />)}</dl>}
      </div></div>
      {rows.length > 0 && (
        <div className="ref-stats">
          {rows.map((r, i) => {
            const showKeys = i === 0 || keysOf(r) !== keysOf(rows[i - 1])
            return (
              // The stylesheet picks rows by the literal text "--n:6" in the style attribute (phones), so it is written as is
              <div key={r.label} className={`ref-row ${showKeys ? '' : 'nokeys'}`} ref={(el) => { el?.setAttribute('style', `--n:${r.cells.length}`) }}>
                <span className="ref-row-l">{r.label}</span>
                {r.cells.map(([k, v]) => <span key={k} className="ref-cell">{showKeys && <small>{k}</small>}<b className="num">{v}</b></span>)}
              </div>
            )
          })}
        </div>
      )}
      {tabs}
    </section>
  )
}
const FactRow = ({ k, v }: { k: string; v: ReactNode }) => <><dt>{k}</dt><dd>{v}</dd></>

// The club logo drawn as true vector outlines (headers): the logo's own SVG, copied to the site's data by the data
// refresh, with its colours, styles and classes taken out so the stylesheet can stroke every shape with one thin line.
// Sharp at any size. Without an SVG for the team, the picture with the outline filter is used instead.
const OUTLINES: Record<string, string | null> = {}
const SHAPES = 'path, polygon, polyline, rect, circle, ellipse, line'
async function outlineSvg(code: string) {
  if (code in OUTLINES) return OUTLINES[code]
  try {
    const res = await fetch(dataUrl(`logos/${code}.svg`))
    if (!res.ok) throw new Error(String(res.status))
    const doc = new DOMParser().parseFromString(await res.text(), 'image/svg+xml')
    const svg = doc.documentElement
    if (svg.nodeName !== 'svg' || doc.querySelector('parsererror')) throw new Error('not an svg')
    // Shapes the logo never paints (fill none and no stroke, like an artboard frame) would show up as outlines: drop them
    const css = [...svg.querySelectorAll('style')].map((s) => s.textContent || '').join('')
    const hidden = new Set([...css.matchAll(/\.([\w-]+)\s*\{([^}]*)\}/g)].filter((m) => /fill\s*:\s*none/i.test(m[2]) && !/stroke\s*:\s*(?!none)/i.test(m[2])).map((m) => m[1]))
    svg.querySelectorAll(SHAPES).forEach((n) => {
      const fillNone = n.getAttribute('fill') === 'none' || /fill\s*:\s*none/i.test(n.getAttribute('style') || '') || [...n.classList].some((c) => hidden.has(c))
      const stroked = (n.getAttribute('stroke') || 'none') !== 'none' || /stroke\s*:\s*(?!none)/i.test(n.getAttribute('style') || '')
      if (fillNone && !stroked) n.remove()
    })
    svg.querySelectorAll('script, style, foreignObject, image, text').forEach((n) => n.remove())
    for (const n of [svg, ...svg.querySelectorAll('*')]) {
      for (const a of [...n.attributes]) if (/^on/i.test(a.name) || a.name === 'class' || a.name === 'style' || a.name === 'id') n.removeAttribute(a.name)
    }
    svg.querySelectorAll(SHAPES).forEach((n) => { n.removeAttribute('fill'); n.removeAttribute('stroke') })
    svg.removeAttribute('width'); svg.removeAttribute('height')
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet')
    svg.setAttribute('aria-hidden', 'true')
    return (OUTLINES[code] = new XMLSerializer().serializeToString(svg))
  } catch {
    return (OUTLINES[code] = null)
  }
}
export function OutlineLogo({ code, fallback }: { code: string; fallback?: string }) {
  const [svg, setSvg] = useState<string | null | undefined>(() => OUTLINES[code])
  useEffect(() => {
    let off = false
    outlineSvg(code).then((s) => { if (!off) setSvg(s) })
    return () => { off = true }
  }, [code])
  if (svg) return <span className="ref-mark-svg" aria-hidden="true" dangerouslySetInnerHTML={{ __html: svg }} />
  if (svg === null && fallback) return <img className="ref-mark" src={fallback} alt="" />
  return null
}

// The hero's photo; on phones a player photo gets its studio background removed (shared with the leader cards)
function RefPhoto({ src, cls, clean }: { src: string; cls: string; clean: boolean }) {
  const [broken, setBroken] = useState(false)
  if (broken) return null
  if (clean) return <CleanImg key={src} src={src} className="ref-photo" />
  return <img className={`ref-photo ${cls}`} src={src} alt="" onError={() => setBroken(true)} />
}

// Follow a team: a small button in the profile card's top-right corner (a filled star once it is your team)
export function FavButton({ code }: { code: string }) {
  const { fav, setFav } = useData()
  const isFav = fav === code
  return (
    <button className="ref-btn" aria-pressed={isFav} onClick={() => setFav(isFav ? null : code)}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">{isFav ? <path d="M5 12.5l4.5 4.5L19 7.5" /> : <path d="M12 5v14M5 12h14" />}</svg>
      {isFav ? 'Följer' : 'Följ laget'}
    </button>
  )
}

// Regular players who are not in a line-up: at least 40 % of the team's games this season, still in the squad, but not
// on the team sheet. SHL publishes no injury list, so this is the closest sign of who is injured (or out for another reason).
function useAbsent(L: Lineup | null | undefined, code: string, on: boolean) {
  const { core, cur } = useData()
  if (!on || !L) return []
  const listed = new Set<string>()
  for (const p of [...Object.values(L.F || {}).flat(), ...Object.values(L.D || {}).flat(), ...(L.G || [])]) {
    if (p.id) listed.add(p.id)
    listed.add(normName(p.name))
  }
  const teamGp = core.standings.find((t) => t.code === code)?.gp || 0
  const min = Math.max(2, Math.ceil(teamGp * 0.4))
  const squad = new Set((core.rosters?.[code] || []).map((p) => p.id))
  const s = core.seasons[cur]
  return [
    ...s.skaters.filter((p) => p.team === code && p.gp >= min).map((p) => ({ id: p.id, name: p.name, num: p.num, pos: p.pos, gp: p.gp })),
    ...s.goalies.filter((p) => p.team === code && p.gpi >= min).map((p) => ({ id: p.id, name: p.name, num: p.num, pos: 'GK', gp: p.gpi })),
  ].filter((p) => (!squad.size || squad.has(p.id)) && !listed.has(p.id) && !listed.has(normName(p.name))).sort((a, b) => b.gp - a.gp)
}

// A team's lines: goalies, forward lines and defence pairs as rows of player chips.
// absent: also list the regulars missing from it (coming and live games, the team page)
export function LineupGrid({ L, code, absent: showAbsent = false }: { L: Lineup | null | undefined; code: string; absent?: boolean }) {
  const absent = useAbsent(L, code, showAbsent)
  if (!L) return <Empty>Ingen uppställning ännu. Den visas efter lagets första match.</Empty>
  const chip = (r: LineupPlayer | undefined, i: number) => {
    if (!r) return <span key={i} className="lu-p empty" />
    const inner = <><Avatar id={r.id} name={r.name} team={code} eager /><b>{shortName(r.name)}</b><small>#{r.num ?? '–'}{POS_SHORT[r.pos || ''] ? ` · ${POS_SHORT[r.pos || '']}` : ''}</small></>
    return r.id ? <a key={i} className="lu-p" href={`#/spelare/${encodeURIComponent(r.id)}`}>{inner}</a> : <div key={i} className="lu-p">{inner}</div>
  }
  const row = (lab: string, list: LineupPlayer[] | undefined, n: number) => (
    <div className="lu-row" key={lab}><span className="lu-lab">{lab}</span><div className={`lu-chips n${n}`}>{Array.from({ length: n }, (_, i) => chip(list?.[i], i))}</div></div>
  )
  const keys = (o?: Record<string, unknown>) => Object.keys(o || {}).filter((k) => k !== 'null').sort((a, b) => +a - +b)
  return (
    <div className="lu">
      {L.G?.length ? row('Målvakter', L.G.slice(0, 2), 2) : null}
      {keys(L.F).map((k) => row(`Kedja ${k}`, L.F![k], 3))}
      {keys(L.D).map((k) => row(`Backpar ${k}`, L.D![k], 2))}
      {absent.length > 0 && <>
        <div className="lu-row lu-out">
          <span className="lu-lab">Saknas</span>
          <div className="lu-chips n3">
            {absent.map((p) => (
              <a key={p.id} className="lu-p out" href={`#/spelare/${encodeURIComponent(p.id)}`} title={`${p.name}: ${p.gp} matcher i år, inte med i uppställningen`}>
                <Avatar id={p.id} name={p.name} team={code} eager /><b>{shortName(p.name)}</b><small>#{p.num ?? '–'}{POS_SHORT[p.pos || ''] ? ` · ${POS_SHORT[p.pos || '']}` : ''} · {p.gp} M</small>
              </a>
            ))}
          </div>
        </div>
        <p className="lu-note">Ordinarie spelare som inte finns med i uppställningen, oftast på grund av skada. SHL publicerar ingen skadelista.</p>
      </>}
    </div>
  )
}

// The player card on a player's own page: the impact number and the percentiles, in the team's colour
export function PlayerCardCompact({ x }: { x: Card }) {
  const { prev, cur } = useData()
  useTheme()
  const grpName = x.grp === 'G' ? 'målvakter' : x.grp === 'D' ? 'backar' : 'forwards', minGp = x.minGp || MIN_GP, pct = Math.round(x.impact * 100)
  const tc = readable(teamHue(x.team))
  // The impact as a ring in the team colour; each percentile as a bar row (red under 25, grey under 50, team colour above)
  const R = 34, C = 2 * Math.PI * R
  return (
    <div className={pcard.card} style={{ '--tc': tc } as React.CSSProperties}>
      <div className={pcard.top}>
        <svg className={pcard.ring} viewBox="0 0 84 84" aria-hidden="true">
          <circle cx="42" cy="42" r={R} className={pcard.track} />
          <circle cx="42" cy="42" r={R} className={pcard.fill} strokeDasharray={`${C * x.impact} ${C}`} transform="rotate(-90 42 42)" />
        </svg>
        <span className={pcard.pct}><b className="num">{pct}</b><small>%</small></span>
        <div className={pcard.who}>
          <span className={pcard.k}>Påverkan</span>
          <b>Bättre än {pct} % av SHL-{grpName}</b>
          {x.role && <span className={pcard.role}>{x.role}</span>}
        </div>
      </div>
      <div className={pcard.grid}>
        {(x.metrics || METRICS).map((m) => {
          const p = x.pct[m.k], c = p < 0.25 ? 'var(--bad)' : p < 0.5 ? 'color-mix(in oklab, var(--foreground) 35%, transparent)' : tc
          return (
            <div key={m.k} className={pcard.row}>
              <span className={pcard.label}>{m.label}</span>
              <span className={pcard.bar}><i style={{ width: `${Math.max(2, p * 100)}%`, background: c }} /></span>
              <b className="num">{Math.round(p * 100)}</b>
            </div>
          )
        })}
      </div>
      <p className={pcard.note}>Percentiler bland SHL-{grpName} med minst {minGp} matcher, viktat {prev.slice(0, 2)}/{prev.slice(3)} och {cur.slice(0, 2)}/{cur.slice(3)}.{x.gp < minGp ? ` Litet underlag (${Math.round(x.gp)} viktade matcher).` : ''}</p>
    </div>
  )
}

// The full player card (Nexus): photo on the club colour, impact, role, and every percentile on a red–grey–blue scale
const LOW = [217, 72, 95], MID = [128, 140, 156], HIGH = [74, 146, 224]
const pColor = (p: number) => {
  const [a, b, t] = p < 0.5 ? [LOW, MID, p / 0.5] : [MID, HIGH, (p - 0.5) / 0.5]
  return `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(',')})`
}
export function PlayerCard({ x, link = true }: { x: Card; link?: boolean }) {
  const { prev, cur, headshots, tName } = useData()
  const [broken, setBroken] = useState(false)
  const grpName = x.grp === 'G' ? 'målvakter' : x.grp === 'D' ? 'backar' : 'forwards', minGp = x.minGp || MIN_GP
  const [first, ...rest] = String(x.name).split(' ')
  const name = <><span>{first}</span>{rest.join(' ')}</>
  const photo = headshots[x.id]?.[1]
  return (
    <article className="pcard" style={{ '--tc': tColor(x.team) } as React.CSSProperties}>
      <div className="pc-top pc-hero" style={{ '--tc': (TC[x.team] || ['#3a4a5e'])[0] } as React.CSSProperties}>
        <span className="pc-num" aria-hidden="true">{x.num ?? ''}</span>
        {photo && !broken ? <img className="pc-img" src={photo} alt="" onError={() => setBroken(true)} /> : <span className="pc-ini">{initials(x.name)}</span>}
        <div className="pc-war"><span className="lbl">Påverkan</span><span className="big num">{Math.round(x.impact * 100)}%</span></div>
        <div className="pc-info">
          <div className="pc-team"><TeamBadge code={x.team} size="md" /><span>{tName(x.team)} · #{x.num ?? '–'} · {x.grp === 'G' ? 'MV' : POS_SHORT[x.pos] || 'F'}</span></div>
          <h3 className="pc-name">{link ? <a href={`#/spelare/${encodeURIComponent(x.id)}`}>{name}</a> : name}</h3>
          <div className="pc-meta"><span>Ålder <b>{ageOf(x.born)}</b></span><span>Roll <b>{x.role || '–'}</b></span></div>
        </div>
      </div>
      <div className="pc-grid">
        {(x.metrics || METRICS).map((m) => {
          const p = x.pct[m.k]
          return <div key={m.k} className="metric"><span>{m.label}</span><span className="bar"><i style={{ width: `${Math.max(3, p * 100)}%`, background: pColor(p) }} /></span><span className="pct num" style={{ color: pColor(p) }}>{Math.round(p * 100)}%</span></div>
        })}
      </div>
      <div className="pc-foot">
        <span>Viktat urval {prev} + {cur}, percentil bland SHL-{grpName} (minst {minGp} matcher). {x.gp < minGp && <span className="small-sample">Litet underlag ({Math.round(x.gp)} viktade matcher). Tolka rankningarna försiktigt.</span>}</span>
        <span className="mark">SHLSTATS</span>
      </div>
    </article>
  )
}

// News about a team: the club's own site plus SHL articles that name the team; each opens at the source
export function TeamNewsCards({ code, news }: { code: string; news: TeamNews[] }) {
  return <>{news.map((n, i) => {
    const u = safeUrl(n.url)
    if (!u) return null
    return (
      <a key={i} className="tnews" href={u} target="_blank" rel="noopener">
        <span className="tn-img">{n.img ? <HideOnError src={n.img} /> : <TeamBadge code={code} size="xl" />}</span>
        <span className="tn-body"><span className="tn-meta">{n.src} · {fmtDay(n.date)}</span><b>{n.title}</b><span className="tn-intro">{n.intro}</span></span>
      </a>
    )
  })}</>
}
function HideOnError({ src }: { src: string }) {
  const [gone, setGone] = useState(false)
  return gone ? null : <img src={src} alt="" loading="lazy" onError={() => setGone(true)} />
}

// SHL news as a carousel: rotates every 7 seconds, pauses while you hover or focus it; arrows, dots and swipe
export function NewsBox() {
  const { core } = useData()
  const news: NewsItem[] = core.news || []
  const [i, setI] = useState(0)
  const paused = useRef(false)
  const n = news.length
  const go = (k: number) => setI(((k % n) + n) % n)
  useEffect(() => {
    if (n < 2 || matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const t = setInterval(() => { if (!paused.current && document.visibilityState === 'visible') setI((x) => (x + 1) % n) }, 7000)
    return () => clearInterval(t)
  }, [n])
  const x0 = useRef<number | null>(null)
  if (!n) return <div className="news news-empty"><p>Inga nyheter just nu.</p></div>
  return (
    <div className="news" id="news" aria-roledescription="karusell" aria-label="Senaste nyheterna från SHL"
      onMouseEnter={() => { paused.current = true }} onMouseLeave={() => { paused.current = false }}
      onFocus={() => { paused.current = true }} onBlur={() => { paused.current = false }}
      onTouchStart={(e) => { x0.current = e.touches[0].clientX }}
      onTouchEnd={(e) => {
        if (x0.current == null) return
        const dx = e.changedTouches[0].clientX - x0.current
        x0.current = null
        if (Math.abs(dx) > 40) { go(i + (dx < 0 ? 1 : -1)); paused.current = true }
      }}>
      <div className="nslides">
        {news.map((item, k) => (
          <a key={item.id} className={`nslide ${k === i ? 'on' : ''}`} href={`#/nyheter/${encodeURIComponent(item.id)}`} aria-hidden={k !== i} tabIndex={k === i ? 0 : -1}>
            {item.img && <img src={item.img} alt="" loading={k ? 'lazy' : undefined} />}
            <span className="nslide-shade" />
            <span className="nslide-text"><span className="nslide-meta">{item.label ? `${item.label} · ` : ''}{fmtDay(item.date)}</span><b>{item.title}</b><span className="nslide-intro">{item.intro}</span></span>
          </a>
        ))}
      </div>
      <div className="nctrl">
        <button className="nnav" aria-label="Föregående nyhet" onClick={() => go(i - 1)}>‹</button>
        {news.map((_, k) => <button key={k} className={`ndot ${k === i ? 'on' : ''}`} aria-label={`Nyhet ${k + 1}`} onClick={() => go(k)} />)}
        <button className="nnav" aria-label="Nästa nyhet" onClick={() => go(i + 1)}>›</button>
      </div>
    </div>
  )
}

