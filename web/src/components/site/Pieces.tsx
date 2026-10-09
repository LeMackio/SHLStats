import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useData } from '@/data/context'
import { ageOf, fmtDay, initials, POS_SHORT } from '@/lib/format'
import { resultFor, safeEmbed, safeUrl } from '@/lib/game'
import { MIN_GP, METRICS, type Card } from '@/lib/cards'
import { shortName } from '@/lib/stats'
import { readable, TC, tColor, teamHue } from '@/lib/teams'
import { useTheme } from '@/lib/theme'
import { isFinal, type Clip, type Lineup, type LineupPlayer, type NewsItem, type TeamNews } from '@/lib/types'
import { useNarrow } from '@/lib/useNarrow'
import { Empty } from './Panel'
import { CleanImg } from './Portrait'
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
export function RefHero({ bg, tc, photo, photoCls = '', first, firstCls = '', last, badge, action, big = [], facts = [], rows = [], tabs }: {
  bg?: string
  tc?: string
  photo?: string
  photoCls?: string
  first: ReactNode
  firstCls?: string
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
    <section className="ref" style={tc ? ({ '--tc': tc } as React.CSSProperties) : undefined}>
      {bg && <div className="ref-bg" style={{ backgroundImage: `url('${bg}')` }} />}
      {/* Phones: a player's studio background is removed so the player stands on the card */}
      {photo && <RefPhoto src={photo} cls={photoCls} clean={narrow && !photoCls} />}
      {action && <div className="ref-action">{action}</div>}
      <div className="ref-main"><div className="ref-left">
        <div className={`ref-first ${firstCls}`}>{first}</div>
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
const FactRow = ({ k, v }: { k: string; v: ReactNode }) => <><dt>{k} :</dt><dd>{v}</dd></>

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
      <svg viewBox="0 0 24 24" fill={isFav ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinejoin="round"><path d="M12 3.5l2.6 5.3 5.9.9-4.2 4.1 1 5.8L12 16.9l-5.3 2.7 1-5.8-4.2-4.1 5.9-.9z" /></svg>
      {isFav ? 'Mitt lag' : 'Följ laget'}
    </button>
  )
}

// A team's lines: goalies, forward lines and defence pairs as rows of player chips
export function LineupGrid({ L, code }: { L: Lineup | null | undefined; code: string }) {
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
    </div>
  )
}

// The player card on a player's own page: the impact number and the percentiles, in the team's colour
export function PlayerCardCompact({ x }: { x: Card }) {
  const { prev, cur } = useData()
  useTheme()
  const grpName = x.grp === 'G' ? 'målvakter' : x.grp === 'D' ? 'backar' : 'forwards', minGp = x.minGp || MIN_GP, pct = Math.round(x.impact * 100)
  const tc = readable(teamHue(x.team))
  return (
    <div className="pk">
      <div className="pk-top">
        <div className="pk-imp"><span className="pk-k">Påverkan</span><b className="num">{pct}<small>%</small></b><span className="pk-sub">Bättre än {pct} % av SHL-{grpName}</span></div>
        {x.role && <span className="pk-role">{x.role}</span>}
      </div>
      <div className="pk-grid">
        {(x.metrics || METRICS).map((m) => {
          const p = x.pct[m.k], c = p < 0.25 ? 'var(--bad)' : tc
          return <div key={m.k} className="pk-row"><span className="pk-l">{m.label}</span><span className="pk-bar"><i style={{ width: `${Math.max(2, p * 100)}%`, background: c }} /></span><b className="pk-v num">{Math.round(p * 100)}</b></div>
        })}
      </div>
      <p className="pk-note">Percentiler bland SHL-{grpName} med minst {minGp} matcher, viktat {prev.slice(0, 2)}/{prev.slice(3)} och {cur.slice(0, 2)}/{cur.slice(3)}.{x.gp < minGp ? ` Litet underlag (${Math.round(x.gp)} viktade matcher).` : ''}</p>
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

