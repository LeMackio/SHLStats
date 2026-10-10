import { FinalPlacing, PointsRange, SpecialTeams, TeamScatter } from '@/components/charts/TeamCharts'
import SegmentedControl from '@/components/arc/segmented-control/segmented-control'
import { Board, PageHead, PageSwitch } from '@/components/site/Layout'
import { Panel } from '@/components/site/Panel'
import switchStyles from '@/components/site/Switch.module.css'
import { SortableTable, type Col } from '@/components/site/SortableTable'
import { Legend, StandingsTable } from '@/components/site/Standings'
import { TeamBadge } from '@/components/site/TeamBadge'
import { useData } from '@/data/context'
import { dec, signed } from '@/lib/format'
import { useKeptState } from '@/lib/pageState'
import { rankZone } from '@/lib/stats'
import { useNarrow } from '@/lib/useNarrow'

const TABS = [{ key: '', label: 'Tabell' }, { key: 'odds', label: 'Odds' }]

// Tabell: the table with team stats, and the odds
export function TabellPage({ tab }: { tab: string }) {
  const { cur } = useData()
  const active = tab === 'odds' ? 'odds' : '' // old addresses (#/tabell/lagstatistik …) open the table tab
  return (
    <>
      <PageHead title="Tabell">SHL {cur.replace('-', '/')}. Tryck på ett lag för trupp, schema och odds.</PageHead>
      <PageSwitch base="/tabell" tabs={TABS} active={active} />
      {active === 'odds' ? <OddsTab /> : <TableTab />}
    </>
  )
}

interface TeamRow {
  rank: number; code: string; team: string; name: string
  gp: number; w: number; otw: number; otl: number; l: number; gf: number; ga: number; diff: number; pts: number
  ppm: number | null; gfpg: number | null; gapg: number | null; sog: number | null; sa: number | null
  pp: number | null; pk: number | null; fo: number | null; hits: number | null; pim: number | null; proj: number
}

function TableTab() {
  const { core, tName, fav, stamp } = useData()
  const narrow = useNarrow()
  const [pane, setPane] = useKeptState<'std' | 'adv'>('tabell-pane', 'std')

  const rows: TeamRow[] = core.standings.map((r, i) => {
    const T = core.teamStats[r.code] || ({} as Partial<typeof core.teamStats[string]>), gp = r.gp || 0, tg = T.gp || 0
    return {
      rank: i + 1, code: r.code, team: r.code, name: tName(r.code), gp, w: r.w, otw: r.otw, otl: r.otl, l: r.l, gf: r.gf, ga: r.ga, diff: r.gf - r.ga, pts: r.pts,
      ppm: gp ? r.pts / gp : null, gfpg: gp ? r.gf / gp : null, gapg: gp ? r.ga / gp : null,
      sog: tg ? T.sog! / tg : null, sa: tg ? T.sa! / tg : null, pp: T.ppo ? T.ppg! / T.ppo : null, pk: T.pko ? 1 - T.ppga! / T.pko : null,
      fo: T.fow! + T.fol! ? T.fow! / (T.fow! + T.fol!) : null, hits: tg ? T.hits! / tg : null, pim: tg ? T.pim! / tg : null, proj: core.sim[r.code].proj,
    }
  })

  const d2 = (v: number) => dec(v, 2), d1 = (v: number) => dec(v, 1), pc = (v: number) => dec(v * 100, 1)
  const cols: Col<TeamRow>[] = [
    { k: 'rank', label: '#', asc: true, h: (r) => <span className="rank" style={{ '--zone': rankZone(r.rank) } as React.CSSProperties}>{r.rank}</span> },
    { k: 'name', label: 'Lag', l: true, asc: true, h: (r) => <a className="teamcell" href={`#/lag/${r.code}`}><TeamBadge code={r.code} size="md" /><div className="nm"><b>{r.name}</b></div></a> },
    { k: 'gp', label: 'SM' }, { k: 'w', label: 'V' }, { k: 'otw', label: 'ÖV' }, { k: 'otl', label: 'ÖF' }, { k: 'l', label: 'F', asc: true },
    { k: 'gf', label: 'GM', title: 'Gjorda mål' }, { k: 'ga', label: 'IM', title: 'Insläppta mål', asc: true }, { k: 'diff', label: '+/-', f: signed },
    { k: 'pts', label: 'P' }, { k: 'ppm', label: 'P/M', f: d2 }, { k: 'gfpg', label: 'GM/M', f: d2 },
    { k: 'gapg', label: 'IM/M', asc: true, f: d2 }, { k: 'sog', label: 'Skott/M', f: d1 }, { k: 'sa', label: 'Skott mot/M', asc: true, f: d1 },
    { k: 'pp', label: 'PP%', f: pc }, { k: 'pk', label: 'BP%', f: pc }, { k: 'fo', label: 'Tekn%', f: pc },
    { k: 'hits', label: 'Tackl/M', f: d1 }, { k: 'pim', label: 'Utv/M', asc: true, f: d1 }, { k: 'proj', label: 'Proj. P', f: (v: number) => dec(v, 0) },
  ]
  // Phones: the team code instead of rank and full name
  if (narrow) cols.splice(0, 2, { k: 'name', label: 'Lag', l: true, asc: true, h: (r) => <a className="teamcell" href={`#/lag/${r.code}`}><TeamBadge code={r.code} /><div className="nm"><b>{r.code}</b></div></a> })

  return (
    <Board>
      {narrow
        // Phones: the compact table first, the wide stats table behind a toggle
        ? <Panel title="Tabell" className="wide">
            <div className="tt">
              <SegmentedControl className={`tt-switch ${switchStyles.fill}`} label="Visa" value={pane} onValueChange={(v) => setPane(v as 'std' | 'adv')}
                options={[{ value: 'std', label: 'Tabell' }, { value: 'adv', label: 'Avancerat' }]} />
              <div hidden={pane !== 'std'}><StandingsTable mode="stats" /><Legend /></div>
              <div hidden={pane !== 'adv'}>
                <SortableTable cols={cols} rows={rows} sortKey="pts" fav={fav} minWidth={860} />
                <p className="note">Tryck på en kolumnrubrik för att sortera.</p>
              </div>
            </div>
          </Panel>
        : <Panel title="Tabell" className="wide" foot={<span className="stamp">Uppdaterad {stamp}</span>}
            sub="Tryck på en kolumnrubrik för att sortera. Skott, powerplay, boxplay, tekningar och tacklingar räknas från matchdata.">
            <SortableTable cols={cols} rows={rows} sortKey="rank" desc={false} fav={fav} minWidth={1040} />
            <Legend />
          </Panel>}
      <Panel title="Anfall mot försvar" sub="Gjorda och insläppta mål per match. Bäst är uppe till höger.">
        <div className="chart"><TeamScatter rows={rows.map((r) => ({ code: r.code, name: r.name, x: r.gfpg, y: r.gapg }))} /></div>
      </Panel>
      <Panel title="Specialteam" sub="Powerplay och boxplay i procent.">
        <div className="chart"><SpecialTeams rows={rows} /></div>
      </Panel>
    </Board>
  )
}

function OddsTab() {
  const { core, stamp } = useData()
  // Poängprognos and Slutplacering share one layout: the same rows (ordered by projected points)
  const rows = [...core.standings].sort((a, b) => core.sim[b.code].proj - core.sim[a.code].proj)
  return (
    <Board>
      <Panel title="Odds" className="wide" sub="10 000 simuleringar av resten av grundserien och slutspelet." foot={<span className="stamp">Uppdaterad {stamp}</span>}>
        <StandingsTable mode="proj" />
        <Legend />
        <details className="explain">
          <summary>Hur räknas oddsen?</summary>
          <div className="method">
            <div><h3>Lagstyrka</h3><p>Varje lag får ett anfalls- och ett försvarsvärde från gjorda och insläppta mål per match. Förra säsongen räknas som 15 matchers underlag, dragen mot ligasnittet, och årets matcher läggs ovanpå.</p></div>
            <div><h3>Simulering</h3><p>Resten av grundserien spelas 10 000 gånger med slumpade mål, hemmafördel och övertid. Poäng enligt SHL: 3 för vinst, 2 för vinst efter övertid eller straffar och 1 för förlust efter övertid eller straffar.</p></div>
            <div><h3>Slutspel</h3><p>Plats 1–6 går direkt till kvartsfinal, 7–10 spelar play in i bäst av tre och 13–14 spelar SHL-kval. Slutspelet simuleras också, med omseedning efter varje runda och bäst av sju från kvartsfinal.</p></div>
          </div>
        </details>
      </Panel>
      <Panel title="Poängprognos" sub="Poäng efter 52 omgångar. Stapeln visar 80 % av utfallen och pricken är snittet.">
        <div className="chart"><PointsRange rows={rows} /></div>
      </Panel>
      <Panel title="Slutplacering" sub="Chans i procent att sluta på varje placering efter 52 omgångar.">
        <div className="chart"><FinalPlacing rows={rows} /></div>
      </Panel>
    </Board>
  )
}
