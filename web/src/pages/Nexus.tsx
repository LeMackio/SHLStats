import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { TeamScatter } from '@/components/charts/TeamCharts'
import { CountUp } from '@/components/site/CountUp'
import { Icon } from '@/components/site/Icon'
import { PageHead, Seg } from '@/components/site/Layout'
import { LeaderSection, type LeaderSectionDef } from '@/components/site/Leaders'
import { Empty, PageState, Panel, Skeleton } from '@/components/site/Panel'
import { PickSearch } from '@/components/site/PickSearch'
import { PlayerCard } from '@/components/site/Pieces'
import { Portrait } from '@/components/site/Portrait'
import { SortableTable, type Col } from '@/components/site/SortableTable'
import { Avatar, TeamBadge } from '@/components/site/TeamBadge'
import { dataUrl, useData } from '@/data/context'
import type { Hit } from '@/data/searchIndex'
import { dec, fmtDay, POS_SHORT, sum } from '@/lib/format'
import { safeEmbed } from '@/lib/game'
import { GK_MIN_GP, METRICS, MIN_GP, playerCards, type Card } from '@/lib/cards'
import { isFinal, type Goalie, type Skater } from '@/lib/types'
import { useNarrow } from '@/lib/useNarrow'

// edge.json: shot-level data for the season with every shot's expected goals
interface Edge {
  season: string
  model: { shots: number; goals: number; xg: number; trainedOn: string[]; zones: { hd: number; md: number }; coef: { name: string; weight: number }[] }
  league: { sa: number; ga: number; xga: number; hd: [number, number]; md: [number, number]; ld: [number, number] }
  ids: string[]
  skaters: Record<string, number[]> // sog, g, xg, dangerous shots, dangerous goals, average distance, longest goal, missed+blocked attempts
  goalies: Record<string, number[]> // sa, ga, xga, dangerous [shots, goals], medium [..], easy [..]
  teams: Record<string, number[]> // gp, sf, gf, xgf, sa, ga, xga, hdf, hda, missed for, blocked for, missed against, blocked against
  shots: (number | string | null)[][] // shooter idx, goalie idx, x, y, goal, xg × 1000, team, empty net, strength, game idx, clip idx
  games: [string, string, string, string][] // id, home, away, date
  clips: [string, string][] // embed, thumbnail
}

let EDGE: Edge | null = null
function useEdge() {
  const [e, setE] = useState<Edge | null>(EDGE)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    if (EDGE) return
    fetch(dataUrl('edge.json')).then((r) => r.json()).then((x: Edge) => { EDGE = x; setE(x) }, () => setFailed(true))
  }, [])
  return { e, failed }
}

const pp = (x: number) => (x > 0 ? '+' : '') + dec(x, 1)

export function NexusPage() {
  const { e, failed } = useEdge()
  if (failed) return <PageState title="Nexus kunde inte laddas" description="Försök igen om en stund." />
  if (!e) return <Skeleton />
  return <Nexus E={e} />
}

type SkE = Skater & { e: { sog: number; g: number; xg: number; hd: number; hdg: number; dist: number; long: number; att: number } }
type GkE = Goalie & { e: { sa: number; ga: number; xga: number; hd: [number, number]; md: [number, number]; ld: [number, number] } }

function Nexus({ E }: { E: Edge }) {
  const { core, cur, tName } = useData()
  const standings = core.standings
  const season = core.seasons[cur]
  const lg = E.league, lgSv = lg.sa ? 1 - lg.ga / lg.sa : 0

  const { skRows, gkAll, gkRows, hdQual, maxSa } = useMemo(() => {
    const skBy = new Map(season.skaters.map((p) => [p.id, p])), gkBy = new Map(season.goalies.map((p) => [p.id, p]))
    const skRows: SkE[] = Object.entries(E.skaters).filter(([id]) => skBy.has(id)).map(([id, a]) => ({ ...skBy.get(id)!, e: { sog: a[0], g: a[1], xg: a[2], hd: a[3], hdg: a[4], dist: a[5], long: a[6], att: a[7] || 0 } }))
    const gkAll: GkE[] = Object.entries(E.goalies).filter(([id]) => gkBy.has(id)).map(([id, a]) => ({ ...gkBy.get(id)!, e: { sa: a[0], ga: a[1], xga: a[2], hd: [a[3], a[4]], md: [a[5], a[6]], ld: [a[7], a[8]] } }))
    const maxSa = Math.max(1, ...gkAll.map((g) => g.e.sa)), maxHd = Math.max(1, ...gkAll.map((g) => g.e.hd[0]))
    return { skRows, gkAll, maxSa, gkRows: gkAll.filter((g) => g.e.sa >= maxSa * 0.3), hdQual: new Set(gkAll.filter((g) => g.e.hd[0] >= Math.max(5, maxHd * 0.3))) }
  }, [E, season])

  const sections: LeaderSectionDef[] = useMemo(() => [
    {
      id: 'ex', title: 'Spelare', note: 'Skott på mål', rows: skRows,
      rowsFor: (st) => st.k === 'long' ? skRows.filter((p) => p.e.long > 0) : skRows,
      stats: [
        { k: 'xg', label: 'xG', v: (p: SkE) => p.e.xg, f: (x) => dec(x, 1), tie: (p: SkE) => p.e.g },
        { k: 'gax', label: 'Mål över xG', v: (p: SkE) => p.e.g - p.e.xg, f: pp, tie: (p: SkE) => p.e.g },
        { k: 'hd', label: 'Farliga skott', v: (p: SkE) => p.e.hd, tie: (p: SkE) => p.e.hdg },
        { k: 'long', label: 'Längsta mål (m)', v: (p: SkE) => p.e.long, f: (x) => dec(x, 1) },
        { k: 'icf', label: 'Skottförsök', v: (p: SkE) => p.e.sog + p.e.att, tie: (p: SkE) => p.e.sog },
      ],
    },
    {
      id: 'eg', title: 'Målvakter', note: `Minst ${Math.ceil(maxSa * 0.3)} skott mot`, rows: gkRows,
      rowsFor: (st) => st.k === 'hdsv' ? gkRows.filter((g) => hdQual.has(g)) : gkRows,
      stats: [
        { k: 'gsax', label: 'GSAx', v: (g: GkE) => g.e.xga - g.e.ga, f: pp },
        { k: 'hdsv', label: 'Rädd% farliga', v: (g: GkE) => (hdQual.has(g) ? (1 - g.e.hd[1] / g.e.hd[0]) * 100 : -1), f: (x) => (x < 0 ? '–' : dec(x, 1)) },
        { k: 'dsv', label: 'Rädd% över förv.', v: (g: GkE) => (g.e.xga - g.e.ga) / g.e.sa * 100, f: (x) => (x > 0 ? '+' : '') + dec(x, 2) },
        { k: 'sa', label: 'Skott mot', v: (g: GkE) => g.e.sa },
      ],
    },
  ], [skRows, gkRows, hdQual, maxSa])

  // Team xG. Shot attempts: Corsi = on goal + missed + blocked, Fenwick = on goal + missed (blocked left out)
  const teamRows = standings.map((r) => {
    const t = E.teams[r.code]
    if (!t) return null
    const [gp, sf, gf, xgf, sa, ga, xga, hdf, hda, mf = 0, bf = 0, ma = 0, ba = 0] = t
    const cf = sf + mf + bf, ca = sa + ma + ba, ff = sf + mf, fa = sa + ma
    return {
      code: r.code, team: r.code, name: tName(r.code), gp, xgfpg: xgf / gp, xgapg: xga / gp, xgp: xgf / Math.max(0.001, xgf + xga), fin: gf - xgf, save: xga - ga,
      hdf: hdf / gp, hda: hda / gp, sf: sf / gp, sa: sa / gp, cfpg: cf / gp, capg: ca / gp, cfp: cf / Math.max(1, cf + ca), ffp: ff / Math.max(1, ff + fa),
      sogShare: sf / Math.max(1, cf), blkd: ba / gp, hasAtt: mf + bf + ma + ba > 0,
    }
  }).filter((x): x is NonNullable<typeof x> => !!x)
  type TR = (typeof teamRows)[number]
  const teamCell = (r: TR) => <a className="teamcell" href={`#/lag/${r.code}`}><TeamBadge code={r.code} size="md" /><div className="nm"><b>{r.code}</b></div></a>
  const d2 = (v: number) => dec(v, 2), d1 = (v: number) => dec(v, 1), pc = (v: number) => dec(v * 100, 1)
  // The shot-attempt share bar is centred on 50 %
  const share = (v: number) => <span className="cshare"><span className="cshare-bar"><i className={v >= 0.5 ? 'up' : 'down'} style={{ '--w': `${Math.min(50, Math.abs(v - 0.5) * 250)}%` } as React.CSSProperties} /></span><b className="num">{dec(v * 100, 1)}</b></span>
  const xgCols: Col<TR>[] = [
    { k: 'name', label: 'Lag', l: true, asc: true, h: teamCell },
    { k: 'xgfpg', label: 'xG för/M', f: d2 }, { k: 'xgapg', label: 'xG mot/M', asc: true, f: d2 },
    { k: 'xgp', label: 'xG%', f: pc }, { k: 'hdf', label: 'Farliga/M', f: d1 }, { k: 'hda', label: 'Farl. mot/M', asc: true, f: d1 },
    { k: 'fin', label: 'Avslut', f: pp }, { k: 'save', label: 'Målvakt', f: pp },
  ]
  const corsiCols: Col<TR>[] = [
    { k: 'name', label: 'Lag', l: true, asc: true, h: teamCell },
    { k: 'cfp', label: 'CF%', h: (r) => share(r.cfp) },
    { k: 'cfpg', label: 'Försök/M', f: d1 }, { k: 'capg', label: 'Mot/M', asc: true, f: d1 },
    { k: 'ffp', label: 'FF%', f: pc }, { k: 'sogShare', label: 'På mål%', f: pc }, { k: 'blkd', label: 'Blockerar/M', f: d1 },
  ]
  const zoneRow = (label: string, [n, g]: [number, number]) => <tr key={label}><td className="l">{label}</td><td>{n}</td><td>{g}</td><td className="hl">{n ? dec((1 - g / n) * 100, 1) : '–'}</td></tr>

  return (
    <>
      <p className="beta-note"><span>Beta</span>Nexus är i beta: siffrorna, modellerna och vyerna kan ändras medan vi bygger vidare.</p>
      <PageHead title="Nexus">Skottkvalitet och förväntade mål (xG) för SHL {E.season.replace('-', '/')}. Varje skott på mål värderas efter var det kom ifrån och i vilket läge.</PageHead>
      <div className="lsec-row">{sections.map((s) => <LeaderSection key={s.id} sec={s} />)}</div>

      <ShotMap E={E} skRows={skRows} gkRows={gkRows} gkAll={gkAll} lgSv={lgSv} />

      <div className="ov-row r-two">
        <Panel title="Rättvis tabell" sub="Tabellen som den borde se ut om varje match slutat som chanserna (xG) sa."><FairTable E={E} /></Panel>
        <SimilarCard />
      </div>
      <div className="ov-row r-two">
        <CardPanel />
        <Panel title="Lag: xG för och mot" sub="Förväntade mål per match. Bäst är uppe till höger: många chanser framåt, få bakåt.">
          <div className="chart"><TeamScatter rows={teamRows.map((r) => ({ code: r.code, name: r.name, x: r.xgfpg, y: r.xgapg }))} xLabel="xG för per match" what={['xG för', 'xG mot']} /></div>
        </Panel>
      </div>
      {teamRows.some((r) => r.hasAtt) && (
        <div className="ov-row r-one">
          <Panel title="Lag: skottförsök (Corsi)" sub="Alla skottförsök: på mål, utanför och blockerade. Andelen (CF%) visar vilket lag som har pucken och skapar mest, oavsett hur bra skotten var. Fenwick (FF%) räknar bort blockerade skott.">
            <SortableTable cols={corsiCols} rows={teamRows.filter((r) => r.hasAtt)} sortKey="cfp" minWidth={640} />
          </Panel>
        </div>
      )}
      <div className="ov-row r-one">
        <Panel title="Lag: xG-statistik" sub="Avslut = gjorda mål minus xG (skärpa framåt). Målvakt = xG mot minus insläppta (målvaktsspel).">
          <SortableTable cols={xgCols} rows={teamRows} sortKey="xgp" minWidth={640} />
        </Panel>
      </div>
      <div className="ov-row r-two">
        <Panel title="Var målen görs" sub="Andel skott på mål som blir mål, per område. Ljusare = oftare mål. Rutor med färre än 8 skott visas inte.">
          <div className="chart"><GoalRateMap shots={E.shots.map((s) => ({ x: s[2] as number, y: s[3] as number, g: s[4] as number, en: s[7] as number }))} /></div>
        </Panel>
        <Panel title="Så räknas xG">
          <div className="method" style={{ gridTemplateColumns: '1fr' }}>
            <div><p>Modellen är tränad på {E.model.shots.toLocaleString('sv-SE')} skott på mål från {E.model.trainedOn.join(' och ')}. Den räknar ut sannolikheten att ett skott blir mål utifrån avstånd, vinkel, om det är en retur, spelläge, om det är övertid (3 mot 3) och om kassen är tom. Summerat över alla skott förväntar den sig {E.model.xg.toLocaleString('sv-SE')} mål, och det blev {E.model.goals.toLocaleString('sv-SE')}.</p></div>
            <div><p>Farliga skott är skott med minst {Math.round(E.model.zones.hd * 100)} % chans att bli mål. Ligans räddningsprocent är {dec(lgSv * 100, 1)} totalt.</p></div>
            <div><p>SHL publicerar ingen spårningsdata, så skottfart, skridskofart och missade eller blockerade skott finns inte med. Modellen ser bara skott som går på mål.</p></div>
          </div>
          <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 6 }}>
            <table className="t"><thead><tr><th className="l">Faktor</th><th>Chans</th></tr></thead>
              <tbody>{E.model.coef.map((c) => <tr key={c.name}><td className="l">{c.name}</td><td className={c.weight > 0 ? undefined : 'faint'}>{c.weight > 0 ? 'Ökar' : 'Minskar'}</td></tr>)}</tbody></table>
            <table className="t"><thead><tr><th className="l">Läge</th><th>Skott</th><th>Mål</th><th>Rädd%</th></tr></thead>
              <tbody>{zoneRow('Farliga', lg.hd)}{zoneRow('Medel', lg.md)}{zoneRow('Enkla', lg.ld)}</tbody></table>
          </div>
        </Panel>
      </div>
    </>
  )
}

const Tile = ({ k, v, s }: { k: string; v: string | number; s?: ReactNode }) => (
  <div className="tile"><span className="k">{k}</span><span className="v"><CountUp text={String(v)} /></span>{s ? <span className="s">{s}</span> : null}</div>
)

interface Shot { k: number; sh: string | null; gk: string | null; x: number; y: number; g: number; xg: number; team: string; en: number; str: number; game: Edge['games'][number] | null; opp: string | null; clip: number }

// Shot map explorer: pick a player, goalie or team, filter by outcome and game state, click a goal for its video
function ShotMap({ E, skRows, gkRows, gkAll, lgSv }: { E: Edge; skRows: SkE[]; gkRows: GkE[]; gkAll: GkE[]; lgSv: number }) {
  const { core, cur, tName, fav } = useData()
  const narrow = useNarrow()
  const HD = E.model.zones.hd
  const shotsAll: Shot[] = useMemo(() => E.shots.map((s, k) => {
    const game = E.games?.[s[9] as number] || null, team = s[6] as string
    return {
      k, sh: (s[0] as number) >= 0 ? E.ids[s[0] as number] : null, gk: (s[1] as number) >= 0 ? E.ids[s[1] as number] : null, x: s[2] as number, y: s[3] as number,
      g: s[4] as number, xg: (s[5] as number) / 1000, team, en: s[7] as number, str: (s[8] as number) ?? 0, game, opp: game ? (game[1] === team ? game[2] : game[1]) : null, clip: (s[10] as number) ?? -1,
    }
  }), [E])
  const [kind, setKind] = useState<'sk' | 'gk' | 't'>('sk')
  const [side, setSide] = useState<'for' | 'mot'>('for')
  const [show, setShow] = useState<'all' | 'g' | 'hd'>('all')
  const [str, setStr] = useState<'all' | '0' | '1' | '2'>('all')
  const [view, setView] = useState<'dots' | 'heat'>('dots')
  const [sel, setSel] = useState(-1)
  const picksFor = (k: typeof kind) => k === 'sk' ? [...skRows].sort((a, b) => b.e.g - a.e.g || b.e.xg - a.e.xg).slice(0, 8)
    : k === 'gk' ? [...gkRows].sort((a, b) => b.e.sa - a.e.sa).slice(0, 8) : core.standings.map((r) => ({ id: r.code, name: tName(r.code), team: r.code }))
  const [id, setId] = useState<string | null>(() => picksFor('sk')[0]?.id ?? null)
  const detail = useRef<HTMLDivElement>(null)

  const defensive = kind === 'gk' || (kind === 't' && side === 'mot')
  const pool = shotsAll.filter((s) => kind === 'sk' ? s.sh === id : kind === 'gk' ? s.gk === id : side === 'for' ? s.team === id : s.opp === id)
  const list = pool.filter((s) => str === 'all' || s.str === +str)
  const shown = list.filter((s) => show === 'all' || (show === 'g' ? s.g : s.xg >= HD))
  const pick = (x: string | null | undefined) => { if (!x) return; setId(x); setSel(-1) }
  const changeKind = (k: typeof kind) => { setKind(k); pick(k === 't' && fav ? fav : picksFor(k)[0]?.id) }
  const nameOf = (pid: string | null) => season(core, cur).find((p) => p.id === pid)?.name || 'Okänd'

  // Who is shown, and the numbers for the shots in the chosen game state
  const n = list.length, g = sum(list.map((s) => s.g)), xg = sum(list.map((s) => s.xg))
  const hd = list.filter((s) => s.xg >= HD), dist = n ? sum(list.map((s) => Math.hypot(s.x, s.y) / 10)) / n : 0
  const ne = list.filter((s) => !s.en), neG = sum(ne.map((s) => s.g)), neXg = sum(ne.map((s) => s.xg))
  let who: ReactNode = null
  if (kind === 't' && id) who = <div className="smap-who"><TeamBadge code={id} size="xl" /><div><a className="lfeat-name" href={`#/lag/${id}`}>{tName(id)}</a><div className="lfeat-meta"><span>{side === 'for' ? 'Lagets skott' : 'Skott mot laget'}</span></div></div></div>
  else {
    const p = (kind === 'sk' ? skRows : gkAll).find((r) => r.id === id)
    if (p) who = (
      <div className="smap-who"><Portrait id={p.id} name={p.name} team={p.team} size="sm" />
        <div><a className="lfeat-name" href={`#/spelare/${encodeURIComponent(p.id)}`}>{p.name}</a><div className="lfeat-meta"><TeamBadge code={p.team} /><span>{p.team} · #{p.num ?? '–'} · {POS_SHORT[p.pos] || 'F'}</span></div></div></div>
    )
  }
  const bands = ([['Nära mål', 0, 6], ['Mellandistans', 6, 12], ['Långt ifrån', 12, 999]] as const).map(([label, a, b]) => {
    const inBand = list.filter((s) => { const d = Math.hypot(s.x, s.y) / 10; return d >= a && d < b })
    return { label, n: inBand.length, g: sum(inBand.map((s) => s.g)) }
  })
  const mx = Math.max(1, ...bands.map((b) => b.n))
  const color = defensive ? 'var(--bad)' : 'var(--accent)'
  const selectGoal = (k: number) => {
    setSel(k)
    if (narrow) requestAnimationFrame(() => detail.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }))
  }
  const picks = picksFor(kind)
  const searchFilter = useCallback((h: Hit) => h.type === 'p' && (kind === 'sk' ? !!E.skaters[h.id] : !!E.goalies[h.id]), [kind, E])

  return (
    <section className="panel smap-panel" id="shotmap">
      <div className="p-head"><h2>Skottkarta</h2><p className="p-sub">Varje skott på mål {E.season.replace('-', '/')}. Större prick = farligare chans. Tryck på ett mål för att se det.</p></div>
      <div className="p-body"><div className="smap">
        <div className="smap-side">
          <Seg id="sm-kind" value={kind} onChange={changeKind} options={[['sk', 'Spelare'], ['gk', 'Målvakt'], ['t', 'Lag']]} />
          {kind !== 't' && <PickSearch key={kind} id="sm-search-wrap" placeholder={kind === 'gk' ? 'Sök målvakt' : 'Sök spelare'} label="Sök till skottkartan" filter={searchFilter} onPick={(h) => pick(h.id)} />}
          <div className="chips" id="sm-picks">
            {picks.map((r) => (
              <button key={r.id} className={`chip ${kind === 't' ? 'chip-team' : ''}`} aria-pressed={r.id === id} onClick={() => pick(r.id)}>
                {kind === 't' ? <><TeamBadge code={r.id} />{r.id}</> : r.name}
              </button>
            ))}
          </div>
          <div id="sm-info">
            {who}
            <div className="tiles">
              {defensive ? <>
                <Tile k="Skott mot" v={n} /><Tile k="Insläppta" v={g} />
                <Tile k="Rädd%" v={ne.length ? dec((1 - neG / ne.length) * 100, 1) : '–'} s={`liga ${dec(lgSv * 100, 1)}`} />
                <Tile k="xG mot" v={dec(xg, 1)} /><Tile k="GSAx" v={ne.length ? pp(neXg - neG) : '–'} s="räddat över förväntan" />
                <Tile k="Farliga" v={hd.length} s={hd.length ? `${dec((1 - sum(hd.map((s) => s.g)) / hd.length) * 100, 0)} % räddade` : ''} />
              </> : <>
                <Tile k="Skott" v={n} /><Tile k="Mål" v={g} /><Tile k="xG" v={dec(xg, 1)} /><Tile k="Mål över xG" v={pp(g - xg)} />
                <Tile k="Farliga" v={hd.length} s={`${sum(hd.map((s) => s.g))} mål`} /><Tile k="Snittavstånd" v={n ? dec(dist, 1) : '–'} s="meter" />
              </>}
            </div>
          </div>
          <div id="sm-zones">
            {n > 0 && (
              <div className="sm-zones"><h3>Avstånd</h3>
                {bands.map((b) => (
                  <div className="smz" key={b.label}>
                    <span className="smz-l">{b.label}</span>
                    <div className="smz-bar"><i style={{ width: `${b.n / mx * 100}%` }} /><i className="g" style={{ width: `${b.g / mx * 100}%` }} /></div>
                    <span className="smz-v num">{b.n} <small>{b.g} mål{b.n ? ` · ${Math.round(b.g / b.n * 100)} %` : ''}</small></span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="smap-main">
          <div className="smap-bar">
            {kind === 't' && <Seg id="sm-side" value={side} onChange={(v) => { setSide(v); setSel(-1) }} options={[['for', 'Skott för'], ['mot', 'Skott mot']]} />}
            <Seg id="sm-show" value={show} onChange={setShow} options={[['all', 'Alla'], ['g', 'Mål'], ['hd', 'Farliga']]} />
            <Seg id="sm-str" value={str} onChange={(v) => { setStr(v); setSel(-1) }} options={[['all', 'Alla lägen'], ['0', 'Jämnt'], ['1', 'PP'], ['2', 'BP']]} />
            <Seg id="sm-view" value={view} onChange={setView} options={[['dots', 'Prickar'], ['heat', 'Värme']]} />
          </div>
          <div className="smap-stage" id="sm-rink"><ShotRink shots={shown} color={color} mode={view} sel={sel} onGoal={selectGoal} /></div>
          <div className="legend" id="sm-legend">
            {view === 'heat'
              ? <><span><i style={{ background: color }} />Mörkare = fler och farligare skott</span><span><i style={{ background: color, borderRadius: '50%' }} />{defensive ? 'Insläppt mål' : 'Mål'}</span></>
              : <>
                <span><i style={{ background: color, borderRadius: '50%', boxShadow: `0 0 0 3px color-mix(in srgb, ${color} 35%, transparent)` }} />{defensive ? 'Insläppt mål' : 'Mål'}</span>
                <span><i style={{ background: 'var(--muted)', opacity: 0.55, borderRadius: '50%' }} />Räddat</span><span>Större = högre xG</span><span>Streckat område = farligaste ytan</span>
              </>}
          </div>
          <div id="sm-detail" ref={detail}><GoalDetail E={E} s={sel >= 0 ? shotsAll[sel] : null} nameOf={nameOf} /></div>
        </div>
      </div></div>
    </section>
  )
}
const season = (core: { seasons: Record<string, { skaters: { id: string; name: string }[]; goalies: { id: string; name: string }[] }> }, cur: string) =>
  [...core.seasons[cur].skaters, ...core.seasons[cur].goalies]

const STR_NAME = ['Jämnt', 'Powerplay', 'Boxplay']
function GoalDetail({ E, s, nameOf }: { E: Edge; s: Shot | null; nameOf: (id: string | null) => string }) {
  const { tName } = useData()
  if (!s) return <div className="sm-hint"><Icon name="play" /><span>Tryck på ett mål på kartan för att se vem som gjorde det, hur farlig chansen var och spela upp videon.</span></div>
  const clip = s.clip >= 0 ? E.clips[s.clip] : null, [gid, , , date] = s.game || []
  const title = `${nameOf(s.sh)} mot ${tName(s.opp || '')}`
  return (
    <div className="smd">
      {clip && safeEmbed(clip[0]) && <button className="smd-video" data-embed={clip[0]} data-title={title}>{clip[1] && <img src={clip[1]} alt="" />}<span className="play-ic" /></button>}
      <div className="smd-info">
        <span className="smd-k">Mål{date ? ` · ${fmtDay(date)}` : ''}{s.opp ? ` · mot ${tName(s.opp)}` : ''}</span>
        <b>{s.sh ? <a href={`#/spelare/${encodeURIComponent(s.sh)}`}>{nameOf(s.sh)}</a> : 'Okänd målskytt'} <span className="faint">{s.team}</span></b>
        <div className="smd-facts">
          <span><b>{dec(s.xg * 100, s.xg < 0.1 ? 1 : 0)} %</b> chans (xG)</span><span><b>{dec(Math.hypot(s.x, s.y) / 10, 1)} m</b> från mål</span>
          <span>{s.en ? 'Tom kasse' : STR_NAME[s.str]}</span>{s.gk && !s.en && <span>Målvakt: {nameOf(s.gk)}</span>}
        </div>
        {gid && <a className="more-link" href={`#/match/${gid}`}>Matchfakta ›</a>}
      </div>
    </div>
  )
}

// Half rink seen from above with the net at the top, drawn to scale (1 unit = 1 dm; x = distance out from
// the goal line, y = sideways). Saves are small dots, goals glow and can be clicked. 'heat' shows where the
// shots come from as a soft density map instead of dots.
const RINK = { S: 1.9, pad: 12, xMin: -40, xMax: 230 }
function ShotRink({ shots, color, mode, sel, onGoal }: { shots: Shot[]; color: string; mode: 'dots' | 'heat'; sel: number; onGoal: (k: number) => void }) {
  const { S, pad, xMin, xMax } = RINK
  const W = pad * 2 + 300 * S, H = pad * 2 + (xMax - xMin) * S, cx = W / 2
  const X = (y: number) => cx - y * S, Y = (x: number) => pad + (x - xMin) * S
  const L = X(150), R = X(-150), top = Y(xMin), bot = Y(xMax), cr = 85 * S
  const boards = `M${L} ${bot} L${L} ${top + cr} A${cr} ${cr} 0 0 1 ${L + cr} ${top} L${R - cr} ${top} A${cr} ${cr} 0 0 1 ${R} ${top + cr} L${R} ${bot}`
  const inside = shots.filter((s) => s.x >= xMin && s.x <= xMax)
  const far = shots.length - inside.length
  let heat: ReactNode = null
  if (mode === 'heat') {
    // Density: shots counted in 12 dm cells, drawn as blurred blobs
    const cell = 12, grid = new Map<string, number>()
    for (const s of inside) { const k = `${Math.round(s.x / cell)}|${Math.round(s.y / cell)}`; grid.set(k, (grid.get(k) || 0) + 1 + s.xg * 4) }
    const mx = Math.max(1, ...grid.values())
    heat = (
      <g filter="url(#heat-blur)" clipPath="url(#rink-clip)" className="rk-heat">
        {[...grid].map(([k, v]) => { const [gx, gy] = k.split('|').map(Number); return <circle key={k} cx={X(gy * cell)} cy={Y(gx * cell)} r={cell * S * 1.15} style={{ fill: color, fillOpacity: Math.min(0.95, 0.12 + (v / mx) * 0.85) }} /> })}
      </g>
    )
  }
  const meters = (s: Shot) => dec(Math.hypot(s.x, s.y) / 10, 1)
  return (
    <svg className="rink" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Skottkarta"
      onKeyDown={(e) => { const el = (e.target as Element).closest<SVGGElement>('.sm-goal'); if (el && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onGoal(+el.dataset.k!) } }}>
      <defs>
        <clipPath id="rink-clip"><path d={`${boards} Z`} /></clipPath>
        <filter id="heat-blur" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation={7 * S} /></filter>
        <radialGradient id="goal-glow"><stop offset="0" style={{ stopColor: color, stopOpacity: 0.55 }} /><stop offset="1" style={{ stopColor: color, stopOpacity: 0 }} /></radialGradient>
      </defs>
      <path d={`${boards} Z`} className="rk-ice" />
      <g clipPath="url(#rink-clip)">
        <path d={`M${X(9)} ${Y(0)} L${X(70)} ${Y(60)} L${X(70)} ${Y(105)} L${X(-70)} ${Y(105)} L${X(-70)} ${Y(60)} L${X(-9)} ${Y(0)} Z`} className="rk-slot" />
        <line x1={L} x2={R} y1={Y(0)} y2={Y(0)} className="rk-red" />
        <rect x={L} y={Y(172)} width={R - L} height={3 * S} className="rk-blue" />
        {[70, -70].map((y) => (
          <g key={y}>
            <circle cx={X(y)} cy={Y(60)} r={45 * S} className="rk-circle" /><circle cx={X(y)} cy={Y(60)} r={3 * S} className="rk-dot" />
            <path d={`M${X(y) - 45 * S} ${Y(60) - 4 * S} h${-6 * S} M${X(y) - 45 * S} ${Y(60) + 4 * S} h${-6 * S} M${X(y) + 45 * S} ${Y(60) - 4 * S} h${6 * S} M${X(y) + 45 * S} ${Y(60) + 4 * S} h${6 * S}`} className="rk-hash" />
          </g>
        ))}
        {[70, -70].map((y) => <circle key={`n${y}`} cx={X(y)} cy={Y(200)} r={3 * S} className="rk-dot" />)}
      </g>
      <path d={`M${X(18)} ${Y(0)} A${18 * S} ${18 * S} 0 0 0 ${X(-18)} ${Y(0)} Z`} className="rk-crease" />
      <rect x={X(9.15)} y={Y(-11)} width={18.3 * S} height={11 * S} rx={3 * S} className="rk-net" />
      <path d={boards} className="rk-boards" />
      <text x={R - 8} y={Y(172) - 8} textAnchor="end" className="rk-lbl">Blå linje</text>
      {heat}
      {/* Saves first, goals on top; each marker fades in with a small stagger */}
      {mode !== 'heat' && inside.map((s, i) => s.g ? null : (
        <circle key={`s${s.k}`} cx={X(s.y)} cy={Y(s.x)} r={2.6 + s.xg * 14} className="sm-dot" style={{ '--d': `${Math.min(i, 400) * 2}ms` } as React.CSSProperties}>
          <title>{`Räddat · xG ${dec(s.xg, 2)} · ${meters(s)} m`}</title>
        </circle>
      ))}
      {inside.map((s, i) => {
        if (!s.g) return null
        const r = 5 + s.xg * 16, x = X(s.y), y = Y(s.x)
        return (
          <g key={`g${s.k}`} className={`sm-goal ${s.k === sel ? 'sel' : ''}`} data-k={s.k} tabIndex={0} role="button" aria-label={`Mål, xG ${dec(s.xg, 2)}`}
            style={{ '--d': `${300 + Math.min(i, 400) * 2}ms`, '--c': color } as React.CSSProperties} onClick={() => onGoal(s.k)}>
            <circle cx={x} cy={y} r={r * 2.6} fill="url(#goal-glow)" className="sm-glow" />
            <circle cx={x} cy={y} r={r} className="sm-pulse" />
            <circle cx={x} cy={y} r={r} className="sm-core" />
            <title>{`Mål · xG ${dec(s.xg, 2)} · ${meters(s)} m${s.clip >= 0 ? ' · tryck för video' : ''}`}</title>
          </g>
        )
      })}
      {far > 0 && <text x={cx} y={bot - 8} textAnchor="middle" className="rk-lbl">{far} skott från längre bort än blå linjen visas inte</text>}
    </svg>
  )
}

// Scoring rate by area of the attacking zone, league-wide
function GoalRateMap({ shots }: { shots: { x: number; y: number; g: number; en: number }[] }) {
  const W = 560, H = 330, GX = 36, Y0 = H / 2, cell = 30
  const px = (x: number) => GX + x * 1.8, py = (y: number) => Y0 - y * 1.05
  const grid = new Map<string, [number, number]>()
  for (const s of shots) {
    if (s.en || s.x < 0 || s.x >= 240 || Math.abs(s.y) >= 150) continue
    const k = `${Math.floor(s.x / cell)}|${Math.floor((s.y + 150) / cell)}`
    const c = grid.get(k) || [0, 0]; c[0]++; c[1] += s.g; grid.set(k, c)
  }
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Målprocent per område">
      <rect x="4" y="6" width={W - 8} height={H - 12} rx="70" style={{ fill: 'var(--panel-2)', stroke: 'var(--line)' }} strokeWidth="2" />
      <rect x={W / 2} y="4" width={W / 2} height={H - 8} style={{ fill: 'var(--panel-2)' }} />
      {[...grid].map(([k, [n, g]]) => {
        if (n < 8) return null // too few shots to say anything
        const [cx, cy] = k.split('|').map(Number)
        const rate = g / n, x = px(cx * cell), y = py(cy * cell - 150 + cell), w = cell * 1.8, h = cell * 1.05
        return (
          <g key={k}>
            <rect x={x + 1} y={y + 1} width={w - 2} height={h - 2} rx="4" style={{ fill: 'var(--accent)', fillOpacity: Math.min(0.95, 0.08 + rate * 3.2) }}><title>{`${Math.round(rate * 100)} % av ${n} skott`}</title></rect>
            {n >= 15 && <text x={x + w / 2} y={y + h / 2 + 4} textAnchor="middle" fontSize="12" fontWeight="600" style={{ fill: 'var(--text)' }}>{Math.round(rate * 100)}%</text>}
          </g>
        )
      })}
      <line x1={px(0)} x2={px(0)} y1="22" y2={H - 22} style={{ stroke: 'color-mix(in srgb, var(--bad) 55%, transparent)' }} strokeWidth="2" />
      <rect x={px(0) - 12} y={py(9)} width="12" height={18 * 1.05} rx="2" style={{ fill: 'none', stroke: 'var(--muted)' }} strokeWidth="2" />
      <line x1={px(172)} x2={px(172)} y1="6" y2={H - 6} style={{ stroke: 'color-mix(in srgb, var(--accent) 55%, transparent)' }} strokeWidth="5" />
    </svg>
  )
}

// Rättvis tabell: the standings as the chances say they should look. For every game, both teams' xG
// (empty-net shots left out) give the chance of a win in regulation and of a draw going to overtime; that is
// turned into expected points (3 for a win, 2 or 1 for an overtime result, so 1.5 on average for a draw).
function FairTable({ E }: { E: Edge }) {
  const { core, gamesById, tName } = useData()
  const pois = (l: number) => { const p = [Math.exp(-l)]; for (let k = 1; k <= 12; k++) p.push(p[k - 1] * l / k); return p }
  const perGame = new Map<number, { h: number; a: number }>()
  for (const s of E.shots) {
    if (s[7] || s[9] == null) continue
    const gm = E.games[s[9] as number]
    if (!gm) continue
    const x = perGame.get(s[9] as number) || { h: 0, a: 0 }
    if (s[6] === gm[1]) x.h += (s[5] as number) / 1000; else x.a += (s[5] as number) / 1000
    perGame.set(s[9] as number, x)
  }
  const T = Object.fromEntries(core.standings.map((r) => [r.code, { code: r.code, gp: 0, pts: 0, xpts: 0, xgf: 0, xga: 0, gf: 0, ga: 0 }]))
  for (const [gi, x] of perGame) {
    const [id, home, away] = E.games[gi], g = gamesById[id]
    if (!g || !isFinal(g) || !T[home] || !T[away]) continue
    const ph = pois(x.h), pa = pois(x.a)
    let win = 0, draw = 0, loss = 0
    ph.forEach((a, i) => pa.forEach((b, j) => { if (i > j) win += a * b; else if (i === j) draw += a * b; else loss += a * b }))
    const tot = win + draw + loss; win /= tot; draw /= tot; loss /= tot
    const extra = g.ot || g.so
    const real = (us: number, them: number) => us > them ? (extra ? 2 : 3) : extra ? 1 : 0
    for (const [c, xf, xa, gf, ga, pw] of [[home, x.h, x.a, g.hs!, g.as!, win], [away, x.a, x.h, g.as!, g.hs!, loss]] as [string, number, number, number, number, number][]) {
      const t = T[c]
      t.gp++; t.xgf += xf; t.xga += xa; t.gf += gf; t.ga += ga
      t.xpts += 3 * pw + 1.5 * draw; t.pts += real(gf, ga)
    }
  }
  const rows = Object.values(T).filter((t) => t.gp)
  const realRank = new Map([...rows].sort((a, b) => b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga)).map((t, i) => [t.code, i + 1]))
  rows.sort((a, b) => b.xpts - a.xpts)
  const mx = Math.max(1, ...rows.map((t) => Math.abs(t.pts - t.xpts)))
  return (
    <>
      <div className="tscroll">
        <table className="t fairt" style={{ minWidth: 480 }}>
          <thead><tr><th className="rank">#</th><th className="l">Lag</th><th>M</th><th title="Förväntade poäng utifrån chanserna">xPoäng</th><th>Poäng</th><th>Tur</th><th title="Verklig placering jämfört med den rättvisa">Tabell</th><th>xG%</th></tr></thead>
          <tbody>
            {rows.map((t, i) => {
              const diff = t.pts - t.xpts, move = realRank.get(t.code)! - (i + 1)
              return (
                <tr key={t.code}>
                  <td className="rank">{i + 1}</td>
                  <td className="l"><a className="teamcell" href={`#/lag/${t.code}`}><TeamBadge code={t.code} size="md" /><div className="nm"><b>{tName(t.code)}</b></div></a></td>
                  <td>{t.gp}</td><td className="hl">{dec(t.xpts, 1)}</td><td>{t.pts}</td>
                  <td className="ft-diff"><span className={`ft-bar ${diff >= 0 ? 'up' : 'down'}`} style={{ '--w': `${Math.abs(diff) / mx * 50}%` } as React.CSSProperties} /><b className="num">{diff >= 0 ? '+' : ''}{dec(diff, 1)}</b></td>
                  <td className={`ft-move ${move > 0 ? 'up' : move < 0 ? 'down' : ''}`} title={`Verklig placering: ${realRank.get(t.code)}`}>{move > 0 ? `▼ ${move}` : move < 0 ? `▲ ${-move}` : '–'}</td>
                  <td>{dec(t.xgf / Math.max(0.001, t.xgf + t.xga) * 100, 1)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="note">Tur = verkliga poäng minus xPoäng. Plus betyder fler poäng än chanserna motiverar (skärpa, målvakt eller tur), minus färre. Tabell visar hur många platser laget ligger högre (▲) eller lägre (▼) i den riktiga tabellen.</p>
    </>
  )
}

// Quick picks (chips) and a search, shared by the player card and similar players cards
function useCardPicks() {
  const { core } = useData()
  const CARD = playerCards(core)
  const eligible = [...CARD.values()].filter((x) => x.gp >= MIN_GP)
  const topCards = (grp: string, n: number) => eligible.filter((x) => x.grp === grp).sort((a, b) => b.composite - a.composite).slice(0, n)
  const filter = useCallback((h: Hit) => h.type === 'p' && CARD.has(h.id), [CARD])
  return { CARD, topCards, filter }
}
function Chips({ list, on, pick }: { list: Card[]; on: string; pick: (x: Card) => void }) {
  return <div className="chips">{list.map((p) => <button key={p.id} className="chip" aria-pressed={p.id === on} onClick={() => pick(p)}>{p.name}</button>)}</div>
}

function CardPanel() {
  const { CARD, topCards, filter } = useCardPicks()
  const picks = [...topCards('F', 4), ...topCards('D', 2)]
  const [x, setX] = useState<Card | undefined>(picks[0])
  return (
    <section className="panel">
      <div className="p-head"><h2>Spelarkort</h2><p className="p-sub">Percentiler från ett viktat urval av två säsonger.</p></div>
      <div className="p-body">
        <PickSearch placeholder="Sök spelare" label="Sök spelare" filter={filter} onPick={(h) => setX(CARD.get(h.id))} />
        {x && <><Chips list={picks} on={x.id} pick={setX} /><div id="card-slot"><PlayerCard x={x} /></div></>}
      </div>
    </section>
  )
}

// Liknande spelare: the players whose player card (percentiles, same position) is closest to the chosen one
function SimilarCard() {
  const { core, cur, tName } = useData()
  const { CARD, topCards, filter } = useCardPicks()
  const picks = [...topCards('F', 3), ...topCards('D', 2), [...CARD.values()].filter((y) => y.grp === 'G' && y.gp >= GK_MIN_GP).sort((a, b) => b.composite - a.composite)[0]].filter(Boolean)
  const [x, setX] = useState<Card | undefined>(picks[0])
  const list = useMemo(() => {
    if (!x) return []
    const current = new Set(season(core, cur).map((p) => p.id))
    const metrics = x.metrics || METRICS, keys = metrics.map((m) => m.k)
    return [...CARD.values()]
      .filter((y) => y.id !== x.id && y.grp === x.grp && current.has(y.id) && y.gp >= (y.minGp || MIN_GP))
      .map((y) => ({ y, d: Math.sqrt(keys.reduce((t, k) => t + (x.pct[k] - y.pct[k]) ** 2, 0) / keys.length) }))
      .sort((a, b) => a.d - b.d).slice(0, 5)
      .map(({ y, d }) => ({ y, sim: Math.max(0, 1 - d * 2), shared: metrics.filter((m) => x.pct[m.k] >= 0.7 && y.pct[m.k] >= 0.7).sort((a, b) => (y.pct[b.k] + x.pct[b.k]) - (y.pct[a.k] + x.pct[a.k])).slice(0, 3).map((m) => m.label) }))
  }, [x, CARD, core, cur])
  const posName = x?.grp === 'G' ? 'målvakter' : x?.grp === 'D' ? 'backar' : 'forwards'
  return (
    <section className="panel">
      <div className="p-head"><h2>Liknande spelare</h2><p className="p-sub">Spelarna med mest lika spelarkort, jämfört med andra på samma position.</p></div>
      <div className="p-body sim-body">
        <PickSearch placeholder="Sök spelare eller målvakt" label="Sök spelare att jämföra" filter={filter} onPick={(h) => setX(CARD.get(h.id))} />
        {x && <>
          <Chips list={picks as Card[]} on={x.id} pick={setX} />
          <div id="sim-slot">
            <div className="sim-head"><Avatar id={x.id} name={x.name} team={x.team} size="md" />
              <div className="sim-who"><a href={`#/spelare/${encodeURIComponent(x.id)}`}><b>{x.name}</b></a><span><TeamBadge code={x.team} />{tName(x.team)} · Påverkan {Math.round(x.impact * 100)} %</span></div></div>
            {list.length ? (
              <ol className="sim-list">
                {list.map(({ y, sim, shared }, i) => (
                  <li key={y.id}>
                    <a className="sim-row" href={`#/spelare/${encodeURIComponent(y.id)}`}>
                      <span className="sim-r num">{i + 1}</span><Avatar id={y.id} name={y.name} team={y.team} size="md" />
                      <span className="sim-n"><b>{y.name}</b><small><TeamBadge code={y.team} />{y.team}{shared.length ? ` · ${shared.join(', ')}` : ''}</small></span>
                      <span className="sim-v"><b className="num">{Math.round(sim * 100)} %</b><span className="sim-bar"><i style={{ width: `${sim * 100}%` }} /></span></span>
                    </a>
                  </li>
                ))}
              </ol>
            ) : <Empty>Inga jämförbara {posName} än.</Empty>}
          </div>
        </>}
      </div>
    </section>
  )
}
