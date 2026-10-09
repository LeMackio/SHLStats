import { useEffect, useMemo, useState } from 'react'
import { GsaaChart } from '@/components/charts/TeamCharts'
import { CountUp } from '@/components/site/CountUp'
import { Field, FieldInput, FieldSelect } from '@/components/site/Field'
import { Board, PageHead, Seg, UTabs } from '@/components/site/Layout'
import { Empty, Panel } from '@/components/site/Panel'
import { Portrait } from '@/components/site/Portrait'
import { SlideIndicator } from '@/components/site/SlideIndicator'
import { SortableTable, type Col } from '@/components/site/SortableTable'
import { Avatar, PlayerLink, TeamBadge } from '@/components/site/TeamBadge'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { useData } from '@/data/context'
import { dec, mmss, normName, POS, POS_SHORT, posGroup, signed } from '@/lib/format'
import { useKeptState } from '@/lib/pageState'
import { goalieMinGp, gsaa, shortName } from '@/lib/stats'
import { readable, teamHue, tColor } from '@/lib/teams'
import { useTheme } from '@/lib/theme'
import type { Goalie, Skater } from '@/lib/types'
import { useNarrow } from '@/lib/useNarrow'

type P = Skater | Goalie
interface Stat { k: string; label: string; v: (p: never) => number; tie?: (p: never) => number; asc?: boolean; f?: (x: number) => string }
interface Section { id: string; title: string; note?: string; rows: P[]; stats: Stat[] }

const SECTION_ORDER_PHONE = ['sk', 'df', 'gk', 'rk']

function useSections(): Section[] {
  const { core, cur } = useData()
  return useMemo(() => {
    const season = core.seasons[cur], sk = season.skaters, gmin = goalieMinGp(season.goalies)
    const skStats: Stat[] = [
      { k: 'pts', label: 'Poäng', v: (p: Skater) => p.pts, tie: (p: Skater) => p.g },
      { k: 'g', label: 'Mål', v: (p: Skater) => p.g, tie: (p: Skater) => p.pts },
      { k: 'a', label: 'Assist', v: (p: Skater) => p.a, tie: (p: Skater) => p.pts },
      { k: 'pm', label: '+/-', v: (p: Skater) => p.pm, tie: (p: Skater) => p.pts, f: signed },
    ]
    return [
      { id: 'sk', title: 'Spelare', rows: sk, stats: skStats },
      {
        id: 'gk', title: 'Målvakter', note: `Minst ${gmin} ${gmin === 1 ? 'match' : 'matcher'}`, rows: season.goalies.filter((g) => g.gpi >= gmin),
        stats: [
          { k: 'svp', label: 'Rädd%', v: (g: Goalie) => g.svp, f: (x) => dec(x, 2) },
          { k: 'gaa', label: 'GAA', v: (g: Goalie) => g.gaa, asc: true, f: (x) => dec(x, 2) },
          { k: 'so', label: 'Nollor', v: (g: Goalie) => g.so, tie: (g: Goalie) => g.svp },
          { k: 'gsaa', label: 'GSAA', v: (g: Goalie) => gsaa(g, season), f: (x) => (x > 0 ? '+' : '') + dec(x) },
        ],
      },
      { id: 'df', title: 'Backar', rows: sk.filter((p) => posGroup(p.pos) === 'D'), stats: skStats },
      { id: 'rk', title: 'Rookies', note: 'Första SHL-säsongen', rows: sk.filter((p) => p.rk), stats: skStats },
    ]
  }, [core, cur])
}

export function StatistikPage() {
  const { core, cur, prev } = useData()
  const narrow = useNarrow()
  const sections = useSections()
  const [sec, setSec] = useKeptState('stats-sec', 'sk')
  const [gSeason, setGSeason] = useState(cur)

  return (
    <>
      <PageHead title="Statistik">Topplistor och fullständig statistik för alla SHL-spelare. Tryck på en spelare för hela profilen.</PageHead>
      {/* Phones: one leader section at a time, picked with tabs at the top */}
      {narrow && (
        <Seg className="stat-tabs" id="stat-tabs" value={sec} onChange={setSec}
          options={SECTION_ORDER_PHONE.map((id) => sections.find((s) => s.id === id)!).map((s) => [s.id, s.title])} />
      )}
      <div className="lsec-row">
        {sections.map((s) => <LeaderSection key={s.id} sec={s} hidden={narrow && s.id !== sec} />)}
      </div>
      <AllPlayers />
      <Board>
        <Panel title="Målvakter: räddade mål över snittet" className="gsaa-card"
          sub="Räddningar minus de skott en genomsnittlig SHL-målvakt skulle ha räddat. Tar inte hänsyn till skottens kvalitet.">
          <Seg id="gs" value={gSeason} onChange={setGSeason} options={[[prev, prev], [cur, cur]]} />
          <div className="chart"><GsaaChart season={core.seasons[gSeason]} label={gSeason} isCur={gSeason === cur} /></div>
        </Panel>
      </Board>
    </>
  )
}

// A leader section: tabs for each stat, the leader with a full headshot, and the top 10 beside them.
// Hovering (or tapping) a row in the top 10 shows that player in the big card.
function LeaderSection({ sec, hidden }: { sec: Section; hidden: boolean }) {
  const { headshots } = useData()
  useTheme() // team colours are picked for contrast with the current theme
  const [statKey, setStatKey] = useState(sec.stats[0].k)
  const [on, setOn] = useState(0)
  const stat = sec.stats.find((s) => s.k === statKey)!
  const fmt = stat.f || ((x: number) => String(x))

  const top = useMemo(() => [...sec.rows].sort((a, b) =>
    (stat.asc ? stat.v(a as never) - stat.v(b as never) : stat.v(b as never) - stat.v(a as never)) || (stat.tie ? stat.tie(b as never) - stat.tie(a as never) : 0),
  ).slice(0, 10), [sec.rows, stat])
  const shown = top.map((p) => fmt(stat.v(p as never)))
  // Players with the same value share a rank, shown as T7
  const rankOf = (i: number) => shown.indexOf(shown[i]) + 1
  const tied = (i: number) => shown.filter((x) => x === shown[i]).length > 1

  // Load the other headshots in advance so switching player is instant
  useEffect(() => { for (const p of top.slice(1)) if (headshots[p.id]) new Image().src = headshots[p.id][1] }, [top, headshots])

  const sel = top[on] || top[0]
  return (
    <section className="panel lsec" data-sec={sec.id} hidden={hidden}>
      <div className="p-head"><h2>{sec.title}</h2>{sec.note && <span className="stamp">{sec.note}</span>}</div>
      <UTabs id={`lt-${sec.id}`} value={statKey} onChange={(k) => { setStatKey(k); setOn(0) }} options={sec.stats.map((s) => [s.k, s.label])} />
      <div className="p-body" id={`lb-${sec.id}`}>
        {!top.length ? <Empty>Ingen statistik ännu.</Empty> : (
          <div className="lsec-grid">
            <div className="lfeat-slot"><Feature p={sel} label={stat.label} value={shown[on] ?? shown[0]} /></div>
            <ol className="ltop10 has-ind" style={{ '--pill-c': readable(teamHue(sel.team)) } as React.CSSProperties}>
              <SlideIndicator kind="pill" active=".on" groupKey={`ltop10-${sec.id}`} dep={`${on}|${statKey}|${hidden}`} />
              {top.map((p, i) => (
                <li key={p.id} className={i === on ? 'on' : undefined} style={{ '--rc': readable(teamHue(p.team)) } as React.CSSProperties}
                  onMouseOver={() => setOn(i)} onFocus={() => setOn(i)}
                  onClick={(e) => { if (!(e.target as Element).closest('a')) setOn(i) }}>
                  <span className="r num">{tied(i) ? 'T' : ''}{rankOf(i)}.</span>
                  <TeamBadge code={p.team} /><PlayerLink id={p.id} name={p.name} /><b className="num">{shown[i]}</b>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </section>
  )
}

// The big card on the left of a leader section
function Feature({ p, label, value }: { p: P; label: string; value: string }) {
  const [first, ...rest] = String(p.name).split(' ')
  return (
    <div className="lfeat" style={{ '--tc': tColor(p.team) } as React.CSSProperties}>
      <Portrait id={p.id} name={p.name} team={p.team} size="feat" />
      <div className="lfeat-info">
        <a className="lfeat-name" href={`#/spelare/${encodeURIComponent(p.id)}`}>{first}<br />{rest.join(' ')}</a>
        <div className="lfeat-meta"><TeamBadge code={p.team} /><span>{p.team} · #{p.num ?? '–'} · {POS_SHORT[p.pos] || 'F'}</span></div>
        <div className="lfeat-lbl">{label}</div>
        <div className="lfeat-val num"><CountUp text={value} dur={450} /></div>
      </div>
    </div>
  )
}

type SkRow = Skater & { ppgp: number; shp: number | null }
type GkRow = Goalie & { gsaa: number }

// Alla spelare: the whole table with filters, a closed card until you open it (remembered while browsing)
function AllPlayers() {
  const { core, cur, prev, tName, fav } = useData()
  const narrow = useNarrow()
  const [open, setOpen] = useKeptState('stats-all-open', false)
  const [f, setF] = useKeptState('stats-filters', { kind: 'skaters' as 'skaters' | 'goalies', season: cur, team: 'ALL', pos: 'ALL', rk: false, minGp: 0, q: '' })
  const set = (patch: Partial<typeof f>) => setF({ ...f, ...patch })
  const isSk = f.kind === 'skaters'
  const list: P[] = core.seasons[f.season][f.kind]

  const teams = [...new Set(list.map((p) => p.team))].sort((a, b) => tName(a).localeCompare(tName(b), 'sv'))
  const team = teams.includes(f.team) ? f.team : 'ALL'
  const q = normName(f.q)
  const rows = list.filter((p) => ((isSk ? (p as Skater).gp : (p as Goalie).gpi) >= f.minGp) && (team === 'ALL' || p.team === team)
    && (!isSk || f.pos === 'ALL' || (posGroup(p.pos) === 'D') === (f.pos === 'D')) && (!f.rk || p.rk) && (!q || normName(p.name).includes(q)))
    .map((p) => isSk
      ? { ...p, ppgp: (p as Skater).gp ? (p as Skater).pts / (p as Skater).gp : 0, shp: (p as Skater).sog ? (p as Skater).g / (p as Skater).sog : null }
      : { ...p, gsaa: gsaa(p as Goalie, core.seasons[f.season]) })

  const nameCol: Col<SkRow | GkRow> = {
    k: 'name', label: 'Spelare', l: true, asc: true, h: (r, i) => (
      <div className="pcell rankcell">
        <span className="rk-n num">{i + 1}</span><TeamBadge code={r.team} /><Avatar id={r.id} name={r.name} team={r.team} />
        <div className="rk-nm"><PlayerLink id={r.id} name={narrow ? shortName(r.name) : r.name} /><small>{narrow ? POS_SHORT[r.pos] || 'F' : POS[r.pos] || 'Forward'}</small></div>
      </div>
    ),
  }
  const d2 = (v: number) => dec(v, 2)
  const skCols: Col<SkRow>[] = [nameCol as Col<SkRow>,
    { k: 'gp', label: 'SM', title: 'Spelade matcher' }, { k: 'g', label: 'M', title: 'Mål' }, { k: 'a', label: 'A', title: 'Assist' }, { k: 'pts', label: 'P', title: 'Poäng' },
    { k: 'ppgp', label: 'P/M', title: 'Poäng per match', f: d2 }, { k: 'pm', label: '+/-', f: signed }, { k: 'pim', label: 'Utv', title: 'Utvisningsminuter' },
    { k: 'ppg', label: 'PPM', title: 'Powerplaymål' }, { k: 'gwg', label: 'GWG', title: 'Matchvinnande mål' }, { k: 'sog', label: 'Skott' },
    { k: 'shp', label: 'Sk%', title: 'Skotteffektivitet', f: (v: number) => dec(v * 100, 1) }, { k: 'toi', label: 'Istid', title: 'Istid per match', f: mmss },
    { k: 'hits', label: 'Tackl.' }, { k: 'blk', label: 'Block' },
  ]
  const gkCols: Col<GkRow>[] = [nameCol as Col<GkRow>,
    { k: 'gpi', label: 'SM', title: 'Spelade matcher' }, { k: 'w_', label: 'V', title: 'Vinster' }, { k: 'l', label: 'F', title: 'Förluster' },
    { k: 'sv', label: 'Räddn.' }, { k: 'ga', label: 'Insl.', asc: true }, { k: 'svp', label: 'Rädd%', f: d2 },
    { k: 'gaa', label: 'GAA', title: 'Insläppta mål per 60 minuter', asc: true, f: d2 }, { k: 'so', label: 'Nollor' },
    { k: 'gsaa', label: 'GSAA', title: 'Räddade mål över snittet', f: (v: number) => (v > 0 ? '+' : '') + dec(v) }, { k: 'mins', label: 'Minuter', f: (v: number) => Math.round(v) },
  ]

  return (
    <Collapsible open={open} onOpenChange={setOpen} render={<section className={`panel alla-card ${open ? 'open' : ''}`} id="alla" />}>
      <CollapsibleTrigger className="alla-toggle" id="alla-toggle">
        <span className="alla-title"><b>Alla spelare</b><small>Hela tabellen med filter för lag, position, säsong och rookies</small></span>
        <svg className="alla-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
      </CollapsibleTrigger>
      <CollapsibleContent className="p-body" id="alla-body">
        <div className="controls">
          <Seg id="sk" value={f.kind} onChange={(kind) => set({ kind })} options={[['skaters', 'Spelare'], ['goalies', 'Målvakter']]} />
          <Field label="Säsong"><FieldSelect label="Säsong" value={f.season} onChange={(season) => set({ season })} options={[[cur, cur], [prev, prev]]} /></Field>
          <Field label="Lag"><FieldSelect label="Lag" value={team} onChange={(t) => set({ team: t })} options={[['ALL', 'Alla lag'], ...teams.map((t) => [t, tName(t)] as [string, string])]} /></Field>
          <Field label="Position" hidden={!isSk}><FieldSelect label="Position" value={f.pos} onChange={(pos) => set({ pos })} options={[['ALL', 'Alla'], ['F', 'Forwards'], ['D', 'Backar']]} /></Field>
          <Field label="Visa"><FieldSelect label="Visa" value={f.rk ? '1' : ''} onChange={(v) => set({ rk: !!v })} options={[['', 'Alla spelare'], ['1', 'Endast rookies']]} /></Field>
          <Field label="Minst matcher"><FieldInput id="sm" type="number" min={0} className="w-[62px]" value={f.minGp} onChange={(e) => set({ minGp: +e.target.value || 0 })} /></Field>
          <Field label="Sök"><FieldInput id="sq" type="search" placeholder="Namn" className="w-[170px]" value={f.q} onChange={(e) => set({ q: e.target.value })} /></Field>
        </div>
        {isSk
          ? <SortableTable key={`sk-${f.season}`} cols={skCols} rows={rows as SkRow[]} sortKey="pts" limit={25} fav={fav} />
          : <SortableTable key={`gk-${f.season}`} cols={gkCols} rows={rows as GkRow[]} sortKey="svp" limit={25} fav={fav} />}
      </CollapsibleContent>
    </Collapsible>
  )
}
