import { useMemo, useState } from 'react'
import { GsaaChart } from '@/components/charts/TeamCharts'
import { Input } from '@/components/arc/input/input'
import { SearchField } from '@/components/arc/search-field/search-field'
import { Select } from '@/components/arc/select/select'
import filters from '@/components/site/Filters.module.css'
import { Board, PageHead, Seg } from '@/components/site/Layout'
import { LeaderSection, type LeaderSectionDef, type LeaderStat } from '@/components/site/Leaders'
import { Panel } from '@/components/site/Panel'
import { SortableTable, type Col } from '@/components/site/SortableTable'
import { Avatar, PlayerLink, TeamBadge } from '@/components/site/TeamBadge'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { useData } from '@/data/context'
import { dec, mmss, normName, POS, POS_SHORT, posGroup, signed } from '@/lib/format'
import { useKeptState } from '@/lib/pageState'
import { goalieMinGp, gsaa, shortName } from '@/lib/stats'
import type { Goalie, Skater } from '@/lib/types'
import { useNarrow } from '@/lib/useNarrow'

type P = Skater | Goalie
type Stat = LeaderStat
type Section = LeaderSectionDef

const SECTION_ORDER_PHONE = ['sk', 'df', 'gk', 'jr']

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
      // Juniors as shl.se counts them: at most 20 in the year the season ends
      { id: 'jr', title: 'Juniorer', note: `Födda ${2000 + Number(cur.slice(3)) - 20} eller senare`, rows: sk.filter((p) => p.jr), stats: skStats },
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
        <Seg className="stat-tabs" id="stat-tabs" fill label="Topplista" value={sec} onChange={setSec}
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

type SkRow = Skater & { ppgp: number; shp: number | null }
type GkRow = Goalie & { gsaa: number }

// Alla spelare: the whole table with filters, a closed card until you open it (remembered while browsing)
function AllPlayers() {
  const { core, cur, prev, tName, fav } = useData()
  const narrow = useNarrow()
  const [open, setOpen] = useKeptState('stats-all-open', false)
  const [f, setF] = useKeptState('stats-filters', { kind: 'skaters' as 'skaters' | 'goalies', season: cur, team: 'ALL', pos: 'ALL', jr: false, minGp: 0, q: '' })
  const set = (patch: Partial<typeof f>) => setF({ ...f, ...patch })
  const isSk = f.kind === 'skaters'
  const list: P[] = core.seasons[f.season][f.kind]

  const teams = [...new Set(list.map((p) => p.team))].sort((a, b) => tName(a).localeCompare(tName(b), 'sv'))
  const team = teams.includes(f.team) ? f.team : 'ALL'
  const q = normName(f.q)
  const rows = list.filter((p) => ((isSk ? (p as Skater).gp : (p as Goalie).gpi) >= f.minGp) && (team === 'ALL' || p.team === team)
    && (!isSk || f.pos === 'ALL' || (posGroup(p.pos) === 'D') === (f.pos === 'D')) && (!f.jr || p.jr) && (!q || normName(p.name).includes(q)))
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
        <span className="alla-title"><b>Alla spelare</b><small>Hela tabellen med filter för lag, position, säsong och juniorer</small></span>
        <svg className="alla-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
      </CollapsibleTrigger>
      <CollapsibleContent className="p-body" id="alla-body">
        <Seg id="sk" label="Visa" fill value={f.kind} onChange={(kind) => set({ kind })} options={[['skaters', 'Spelare'], ['goalies', 'Målvakter']]} />
        <div className={filters.filters}>
          <Select label="Säsong" value={f.season} onValueChange={(season) => set({ season })} options={[{ value: cur, label: cur }, { value: prev, label: prev }]} />
          <Select label="Lag" value={team} onValueChange={(t) => set({ team: t })} options={[{ value: 'ALL', label: 'Alla lag' }, ...teams.map((t) => ({ value: t, label: tName(t) }))]} />
          {isSk && <Select label="Position" value={f.pos} onValueChange={(pos) => set({ pos })} options={[{ value: 'ALL', label: 'Alla' }, { value: 'F', label: 'Forwards' }, { value: 'D', label: 'Backar' }]} />}
          <Select label="Spelare" value={f.jr ? 'jr' : 'all'} onValueChange={(v) => set({ jr: v === 'jr' })} options={[{ value: 'all', label: 'Alla spelare' }, { value: 'jr', label: 'Endast juniorer' }]} />
          <Input label="Minst matcher" type="number" inputMode="numeric" min={0} value={f.minGp} onChange={(e) => set({ minGp: +e.target.value || 0 })} />
          <SearchField label="Sök" placeholder="Namn" clearLabel="Rensa sökningen" value={f.q} onValueChange={(q) => set({ q })} />
        </div>
        {isSk
          ? <SortableTable key={`sk-${f.season}`} cols={skCols} rows={rows as SkRow[]} sortKey="pts" limit={25} fav={fav} />
          : <SortableTable key={`gk-${f.season}`} cols={gkCols} rows={rows as GkRow[]} sortKey="svp" limit={25} fav={fav} />}
      </CollapsibleContent>
    </Collapsible>
  )
}
