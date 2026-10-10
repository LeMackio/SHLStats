import { useLayoutEffect, useState } from 'react'
import { HBars, LineChart } from '@/components/charts/Basic'
import { GameRow } from '@/components/site/Games'
import { Board, RouteTabs, Seg, type TabDef } from '@/components/site/Layout'
import { Empty, Panel, Skeleton } from '@/components/site/Panel'
import { ClipCard, FavButton, FormChips, LeaderList, LineupGrid, RefHero, TeamNewsCards } from '@/components/site/Pieces'
import { Avatar, PlayerLink, TeamBadge, TeamLink } from '@/components/site/TeamBadge'
import { useData } from '@/data/context'
import { teamsFile, useFile } from '@/data/loaders'
import { dec, fmtDate, fmtDay, mmss, oddsTxt, pctTxt, signed, sum } from '@/lib/format'
import { ordinal } from '@/lib/game'
import { NAT } from '@/lib/nat'
import { usePageTitle } from '@/lib/pageTitle'
import { teamAccent } from '@/lib/teams'
import { useTheme } from '@/lib/theme'
import { isFinal, type Game, type GoalClip, type Skater, type TeamNews } from '@/lib/types'
import { useChartWidth, useNarrow } from '@/lib/useNarrow'
import { NotFound } from './NotFound'
import season from './LagSeason.module.css'

const TABS = ['', 'form', 'trupp', 'schema', 'historik']

export function LagPage({ code, tab: want }: { code: string; tab: string }) {
  const { core, games, cur, tName, teams } = useData()
  const { current } = useTheme()
  const TD = useFile(teamsFile)
  const s = core.sim[code], r = core.standings.find((t) => t.code === code)

  // Charts and highlights on this page use the club colour, picked to stay readable on the current theme
  useLayoutEffect(() => {
    const app = document.getElementById('app'), ta = teamAccent(code)
    if (!app || !ta) return
    app.style.setProperty('--accent', ta.accent)
    app.style.setProperty('--accent-ink', ta.ink)
    return () => { app.style.removeProperty('--accent'); app.style.removeProperty('--accent-ink') }
  }, [code, current])
  usePageTitle(teams[code] ? tName(code) : null)

  if (!teams[code]) return <NotFound msg="Laget hittades inte." />
  if (!s || !r) return <NotFound msg={`${tName(code)} spelar inte i SHL den här säsongen.`} />
  if (TD.state === 'loading') return <Skeleton />
  const td = TD.state === 'ready' ? TD.data : { logs: {}, news: {} } // the page works without it

  const tab = TABS.includes(want) ? want : ''
  const roster = core.rosters[code] || []
  const teamGames = games.filter((g) => g.home === code || g.away === code)
  const rank = core.standings.indexOf(r) + 1
  const tabs: TabDef[] = [{ key: '', label: 'Översikt' }, { key: 'schema', label: 'Matcher', icon: 'calendar' }, { key: 'trupp', label: 'Trupp', count: roster.length || '' }, { key: 'form', label: 'Statistik', icon: 'chart' }, { key: 'historik', label: 'Historik' }]

  // Every home arena, the most used first (Djurgården: Hovet and Avicii Arena)
  const arenaCount: Record<string, number> = {}
  for (const g of teamGames) if (g.home === code && g.arena) arenaCount[g.arena] = (arenaCount[g.arena] || 0) + 1
  const arenas = Object.keys(arenaCount).sort((a, b) => arenaCount[b] - arenaCount[a])

  return (
    <>
      {/* The profile-style top card, with the club logo where a player's photo would be */}
      <RefHero bg={teams[code].logo} photo={teams[code].logo} photoCls="ref-logo" firstCls="ref-kicker"
        first={`SHL ${cur.replace('-', '/').replace(/^(\d\d)/, '20$1')}`} last={tName(code)} action={<FavButton code={code} />}
        // Only who the team is and where it stands: the record, odds and stats each live in one card below
        big={[['Placering', ordinal(rank)], ['Poäng', r.pts], ['Matcher', r.gp]]}
        facts={[
          ['Form', <FormChips key="form" code={code} />],
          ...(arenas.length ? [[arenas.length > 1 ? 'Arenor' : 'Arena', arenas.join(', ')] as [string, string]] : []),
        ]}
        tabs={<RouteTabs base={`/lag/${code}`} tabs={tabs} active={tab} />} />
      {tab === 'trupp' ? <Roster code={code} />
        : tab === 'schema' ? <Schedule teamGames={teamGames} />
        : tab === 'historik' ? <History code={code} />
        : tab === 'form' ? <Form code={code} logs={td.logs[code] || []} />
        : <Overview code={code} teamGames={teamGames} news={td.news[code] || []} />}
    </>
  )
}

// Team page Poängliga: the same stats as the Statistik page, switched with tabs
const LEADER_STATS: { k: string; label: string; v: (p: Skater) => number; tie: (p: Skater) => number; sub: (p: Skater) => string; f?: (v: number) => string }[] = [
  { k: 'pts', label: 'Poäng', v: (p) => p.pts, tie: (p) => p.g, sub: (p) => `${p.g} mål, ${p.a} assist` },
  { k: 'g', label: 'Mål', v: (p) => p.g, tie: (p) => p.pts, sub: (p) => `${p.sog} skott` },
  { k: 'a', label: 'Assist', v: (p) => p.a, tie: (p) => p.pts, sub: (p) => `${p.pts} poäng` },
  { k: 'pm', label: '+/-', v: (p) => p.pm, tie: (p) => p.pts, sub: (p) => `${p.gp} matcher`, f: signed },
]

function Overview({ code, teamGames, news }: { code: string; teamGames: Game[]; news: TeamNews[] }) {
  const { core, cur, tName } = useData()
  const s = core.sim[code]
  const [stat, setStat] = useState('pts')
  const st = LEADER_STATS.find((x) => x.k === stat)!
  const sk = core.seasons[cur].skaters.filter((p) => p.team === code)
  const days = Object.keys(core.history).sort().filter((d) => core.history[d].t[code])
  const next = teamGames.filter((g) => !isFinal(g)).slice(0, 3), last = teamGames.filter(isFinal).slice(-3).reverse()
  const clips = (core.recentClips || []).filter((c) => c.team === code).slice(0, 4)
  const qf = Object.entries(s.qf || {})

  return (
    <Board>
      {/* What matters now first: the next games and the latest results */}
      <div className="ov-row r-two wide">
        <Panel title="Kommande matcher" more={{ href: `#/lag/${code}/schema`, label: 'Alla matcher' }}>
          {next.length ? <div className="day">{next.map((g) => <GameRow key={g.id} g={g} dated />)}</div> : <Empty>Inga fler matcher.</Empty>}
        </Panel>
        <Panel title="Senaste resultat" more={{ href: `#/lag/${code}/schema`, label: 'Alla resultat' }}>
          {last.length ? <div className="day">{last.map((g) => <GameRow key={g.id} g={g} dated />)}</div> : <Empty>Inga spelade matcher ännu.</Empty>}
        </Panel>
      </div>
      {/* Then the season: the record, form and odds in one card, beside the points list */}
      <div className="ov-row r-two wide">
        <Panel title="Säsongen" more={{ href: `#/lag/${code}/form`, label: 'All statistik' }}><SeasonCard code={code} teamGames={teamGames} /></Panel>
        <Panel title="Poängliga" more={{ href: `#/lag/${code}/trupp`, label: 'Hela truppen' }}>
          <Seg className="lsec-tabs" id="tl-tabs" label="Poängliga: statistik" value={stat} onChange={setStat} options={LEADER_STATS.map((x) => [x.k, x.label])} />
          <div id="tl-body">
            <LeaderList rows={[...sk].sort((a, b) => st.v(b) - st.v(a) || st.tie(b) - st.tie(a))} val={st.v} fmt={st.f || ((v: number) => v)} n={8} logos={false} sub={st.sub} />
          </div>
        </Panel>
      </div>
      {news.length > 0 && (
        <Panel title={`Nyheter om ${tName(code)}`} className="wide" sub="Från klubbens egen sajt och shl.se. Artiklarna öppnas hos källan.">
          <div className="tnews-row"><TeamNewsCards code={code} news={news} /></div>
        </Panel>
      )}
      {clips.length > 0 && (
        <Panel title="Senaste målen">
          <div className="clips">{clips.map((c) => <ClipCard key={c.id} c={c} title={c.scorer?.name || 'Mål'} sub={clipSub(c)} />)}</div>
        </Panel>
      )}
      <Panel title="Slutspelsodds över tid">
        {days.length >= 2 ? <>
          <div className="chart">
            <LineChart label="Slutspelsodds över tid" yFmt={(v) => Math.round(v) + ' %'} xLabels={days.map((d) => `${+d.slice(8)}/${+d.slice(5, 7)}`)} series={[
              { pts: days.map((d) => core.history[d].t[code][1] * 100), color: 'var(--accent)', area: true, label: 'Slutspel' },
              { pts: days.map((d) => core.history[d].t[code][0] * 100), color: 'color-mix(in srgb, var(--accent) 50%, var(--text))', label: 'Topp 6' },
              { pts: days.map((d) => core.history[d].t[code][2] * 100), color: 'var(--gold)', label: 'SM-guld' },
            ]} />
          </div>
        </> : <Empty>Historiken byggs upp efter hand. Varje ny matchdag lägger till en punkt{days.length ? `, första punkten sparades ${fmtDate(days[0])}` : ''}.</Empty>}
      </Panel>
      <Panel title="Slutplacering" sub="Chans att sluta på varje placering efter grundserien.">
        <div className="chart"><RankDist rank={s.rank} /></div>
      </Panel>
      <Panel title="Trolig kvartsfinalmotståndare" sub="Om laget når kvartsfinal: andel av simuleringarna mot varje lag.">
        <div className="chart">
          {qf.length
            ? <HBars items={qf.map(([c, p]) => ({ label: tName(c), code: c, v: p / Math.max(0.001, s.top10) }))} max={1} labelW={130} logos fmt={(v) => pctTxt(v)} />
            : <Empty>Laget når slutspel i för få simuleringar för att visa en trolig motståndare.</Empty>}
        </div>
      </Panel>
    </Board>
  )
}

// The season in one card: the record, goals, the current streak and the last five games, then the odds
function SeasonCard({ code, teamGames }: { code: string; teamGames: Game[] }) {
  const { core } = useData()
  const r = core.standings.find((t) => t.code === code)!, s = core.sim[code]
  const played = teamGames.filter(isFinal)
  const ptsOf = (g: Game) => { const us = g.home === code ? g.hs! : g.as!, them = g.home === code ? g.as! : g.hs!, ex = g.ot || g.so; return us > them ? (ex ? 2 : 3) : ex ? 1 : 0 }
  const won = (g: Game) => ptsOf(g) >= 2
  let streak = 0
  const lastWon = played.length ? won(played[played.length - 1]) : false
  for (let i = played.length - 1; i >= 0 && won(played[i]) === lastWon; i--) streak++
  const five = played.slice(-5), fivePts = sum(five.map(ptsOf))
  const odds: [string, number, string?][] = [['Slutspel', s.top10], ['Topp 6', s.top6], ['SM-guld', s.gold, 'var(--gold)'], ['SHL-kval', s.rel, 'var(--bad)']]
  return (
    <div className={season.card}>
      <div className={season.record}>
        {([['V', r.w], ['ÖV', r.otw], ['ÖF', r.otl], ['F', r.l]] as const).map(([k, v]) => <div key={k}><b className="num">{v}</b><small>{k}</small></div>)}
        <div className={season.goals}><b className="num">{r.gf}–{r.ga}</b><small>Mål ({signed(r.gf - r.ga)})</small></div>
      </div>
      {played.length > 0 && (
        <div className={season.facts}>
          <div><small>Svit</small><b>{streak} {lastWon ? (streak === 1 ? 'vinst' : 'vinster') : streak === 1 ? 'förlust' : 'förluster'} i rad</b></div>
          <div><small>Senaste {five.length}</small><b>{fivePts} av {five.length * 3} poäng</b></div>
          <div><small>Prognos</small><b>{dec(s.proj, 0)} poäng</b></div>
        </div>
      )}
      <div className={season.odds}>
        {odds.map(([k, p, c]) => (
          <div key={k} className={season.odd}>
            <span>{k}</span>
            <span className={season.bar}><i style={{ width: `${Math.max(p > 0 ? 2 : 0, p * 100)}%`, background: c }} /></span>
            <b className="num">{oddsTxt(p)}</b>
          </div>
        ))}
      </div>
    </div>
  )
}
const clipSub = (c: GoalClip) => `${c.team} mot ${c.opp} · ${c.score[0]}–${c.score[1]} · ${fmtDay(c.date)}`

// The chance of finishing in each place after the regular season
function RankDist({ rank }: { rank: number[] }) {
  const W = useChartWidth(560), H = 170, n = rank.length, bw = (W - 30) / n, mx = Math.max(...rank, 0.01)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Slutplacering">
      {rank.map((p, i) => {
        const h = p / mx * (H - 44), x = 20 + i * bw, c = i < 6 ? 'var(--accent)' : i < 10 ? 'color-mix(in srgb, var(--accent) 50%, var(--faint))' : i >= n - 2 ? 'var(--bad)' : 'var(--faint)'
        return (
          <g key={i}>
            <rect x={x + 3} y={H - 22 - h} width={bw - 6} height={h} rx="3" style={{ fill: c }}><title>{`Plats ${i + 1}: ${pctTxt(p, 1)}`}</title></rect>
            <text x={x + bw / 2} y={H - 6} textAnchor="middle" fontSize="11" style={{ fill: 'var(--faint)' }}>{i + 1}</text>
            {p >= 0.02 && <text x={x + bw / 2} y={H - 26 - h} textAnchor="middle" fontSize="10.5" style={{ fill: 'var(--muted)' }}>{Math.round(p * 100)}</text>}
          </g>
        )
      })}
    </svg>
  )
}

function Schedule({ teamGames }: { teamGames: Game[] }) {
  const up = teamGames.filter((g) => !isFinal(g)), done = teamGames.filter(isFinal).reverse()
  return (
    <Board>
      <Panel title={`Kommande matcher (${up.length})`}>
        {up.length ? <div className="day">{up.map((g) => <GameRow key={g.id} g={g} dated />)}</div> : <Empty>Inga fler matcher i grundserien.</Empty>}
      </Panel>
      <Panel title={`Spelade matcher (${done.length})`}>
        {done.length ? <div className="day">{done.map((g) => <GameRow key={g.id} g={g} dated />)}</div> : <Empty>Inga spelade matcher ännu.</Empty>}
      </Panel>
    </Board>
  )
}

type LogRow = { g: Game; id: string; home: boolean; opp: string; gf: number; ga: number; xgf: number | null; xga: number | null; ppg: number; ppo: number; ppga: number; pko: number; res: 'V' | 'ÖV' | 'ÖF' | 'F'; pts: number }

function Form({ code, logs }: { code: string; logs: (string | number | null)[][] }) {
  const { gamesById, tName } = useData()
  const rows: LogRow[] = logs.map((r) => {
    const g = gamesById[r[0] as string]
    if (!g) return null
    const gf = r[2] as number, ga = r[3] as number, win = gf > ga, ex = g.ot || g.so
    return { g, id: r[0] as string, home: !!r[1], opp: r[1] ? g.away : g.home, gf, ga, xgf: r[4] as number | null, xga: r[5] as number | null, ppg: r[6] as number, ppo: r[7] as number, ppga: r[8] as number, pko: r[9] as number,
      res: win ? (ex ? 'ÖV' : 'V') : (ex ? 'ÖF' : 'F'), pts: win ? (ex ? 2 : 3) : (ex ? 1 : 0) } as LogRow
  }).filter((x): x is LogRow => !!x).sort((a, b) => a.g.start.localeCompare(b.g.start))
  if (!rows.length) return <Panel title="Form & statistik"><Empty>Statistiken visas efter lagets första match.</Empty></Panel>

  const pct = (a: number, b: number) => b ? a / b : null
  const agg = (list: LogRow[]) => {
    const n = (k: string) => list.filter((r) => r.res === k).length, t = (k: keyof LogRow) => sum(list.map((r) => (r[k] as number) || 0))
    const xgf = sum(list.map((r) => r.xgf ?? 0)), xga = sum(list.map((r) => r.xga ?? 0))
    return { gp: list.length, V: n('V'), ÖV: n('ÖV'), ÖF: n('ÖF'), F: n('F'), gf: t('gf'), ga: t('ga'), pts: t('pts'),
      pp: pct(t('ppg'), t('ppo')), pk: t('pko') ? 1 - t('ppga') / t('pko') : null, xgp: xgf + xga ? xgf / (xgf + xga) : null, xgf, xga }
  }
  const all = agg(rows), home = agg(rows.filter((r) => r.home)), away = agg(rows.filter((r) => !r.home))

  const RES_TXT = { V: 'Vinst', ÖV: 'Vinst ÖT', ÖF: 'Förlust ÖT', F: 'Förlust' }, RES_CLS = { V: 'w', ÖV: 'o', ÖF: 'ol', F: 'l' }
  const hasXg = rows.some((r) => r.xgf != null)
  const splitRow = (label: string, a: ReturnType<typeof agg>) => (
    <tr key={label}><td className="l"><b>{label}</b></td><td>{a.gp}</td><td>{a.V}</td><td>{a.ÖV}</td><td>{a.ÖF}</td><td>{a.F}</td><td>{a.gf}–{a.ga}</td><td className="hl">{a.pts}</td>
      <td>{a.gp ? dec(a.pts / a.gp, 2) : '–'}</td><td>{a.pp != null ? pctTxt(a.pp, 1) : '–'}</td><td>{a.pk != null ? pctTxt(a.pk, 1) : '–'}</td><td>{a.xgp != null ? pctTxt(a.xgp, 1) : '–'}</td></tr>
  )

  return (
    <Board>
      <Panel title="Säsongsstatistik" className="wide" sub="Lagets siffror och placering i ligan. Stapeln visar placeringen: full stapel = bäst i SHL.">
        <SeasonStats code={code} xgp={all.xgp} gax={all.xgp != null ? all.gf - all.xgf : null} />
      </Panel>
      {/* Match för match: one row per game, newest first: when, where, who, the result, and how the chances (xG) were split */}
      <Panel title="Match för match" className="wide" sub={hasXg ? 'Nyast först. Stapeln visar hur chanserna (xG) fördelades i matchen: fylld del = lagets andel.' : 'Nyast först.'}>
        <div className="tf-list">
          {[...rows].reverse().map((r) => {
            const share = r.xgf != null && r.xgf + (r.xga ?? 0) > 0 ? r.xgf / (r.xgf + (r.xga ?? 0)) : null
            return (
              <a key={r.id} className="tf-row" href={`#/match/${r.id}`}>
                <span className="tf-date">{fmtDay(r.g.start)}</span>
                <span className="tf-opp"><small>{r.home ? 'Hemma mot' : 'Borta mot'}</small><TeamBadge code={r.opp} /><b>{tName(r.opp)}</b></span>
                <span className={`tf-res fm-${RES_CLS[r.res]}`}><b className="num">{r.gf}–{r.ga}</b><small>{RES_TXT[r.res]}</small></span>
                {hasXg && <span className="tf-xg">{share == null ? <small>–</small> : <><small className="num">xG {dec(r.xgf, 1)}–{dec(r.xga, 1)}</small><span className="tf-xgbar"><i style={{ width: `${share * 100}%` }} /></span></>}</span>}
              </a>
            )
          })}
        </div>
      </Panel>
      <Panel title="Hemma och borta">
        <div className="tscroll">
          <table className="t">
            <thead><tr><th className="l"></th><th>SM</th><th>V</th><th>ÖV</th><th>ÖF</th><th>F</th><th>Mål</th><th>P</th><th>P/M</th><th title="Powerplay">PP%</th><th title="Boxplay">BP%</th><th title="Andel av matchernas xG">xG%</th></tr></thead>
            <tbody>{splitRow('Hemma', home)}{splitRow('Borta', away)}{splitRow('Totalt', all)}</tbody>
          </table>
        </div>
      </Panel>
    </Board>
  )
}

// The season's numbers as one list: value, league rank and a bar for the rank (full = best in SHL)
function SeasonStats({ code, xgp, gax }: { code: string; xgp: number | null; gax: number | null }) {
  const { core, codes } = useData()
  const ts = (c: string) => (core.teamStats[c] || {}) as unknown as Record<string, number>
  const row = (c: string) => core.standings.find((t) => t.code === c)
  const per = (c: string, k: 'gf' | 'ga' | 'pts') => { const x = row(c); return x?.gp ? x[k] / x.gp : null }
  const perT = (c: string, k: string) => ts(c).gp ? ts(c)[k] / ts(c).gp : null
  const items: { label: string; f: (c: string) => number | null; fmt: (v: number) => string; asc?: boolean }[] = [
    { label: 'Poäng per match', f: (c) => per(c, 'pts'), fmt: (v) => dec(v, 2) },
    { label: 'Gjorda mål per match', f: (c) => per(c, 'gf'), fmt: (v) => dec(v, 2) },
    { label: 'Insläppta mål per match', f: (c) => per(c, 'ga'), fmt: (v) => dec(v, 2), asc: true },
    { label: 'Skott per match', f: (c) => perT(c, 'sog'), fmt: (v) => dec(v, 1) },
    { label: 'Skott mot per match', f: (c) => perT(c, 'sa'), fmt: (v) => dec(v, 1), asc: true },
    { label: 'Powerplay', f: (c) => ts(c).ppo ? ts(c).ppg / ts(c).ppo : null, fmt: (v) => pctTxt(v, 1) },
    { label: 'Boxplay', f: (c) => ts(c).pko ? 1 - ts(c).ppga / ts(c).pko : null, fmt: (v) => pctTxt(v, 1) },
    { label: 'Tekningar', f: (c) => ts(c).fow + ts(c).fol ? ts(c).fow / (ts(c).fow + ts(c).fol) : null, fmt: (v) => pctTxt(v, 1) },
    { label: 'Utvisningsminuter per match', f: (c) => perT(c, 'pim'), fmt: (v) => dec(v, 1), asc: true },
  ]
  const rankOf = (f: (c: string) => number | null, asc = false) => {
    const v = f(code)
    if (v == null) return null
    return codes.map(f).filter((x): x is number => x != null).filter((x) => (asc ? x < v : x > v)).length + 1
  }
  const n = codes.length
  return (
    <div className={season.stats}>
      {items.map((it) => {
        const v = it.f(code), rk = rankOf(it.f, it.asc)
        return (
          <div key={it.label} className={season.stat}>
            <span className={season.statK}>{it.label}</span>
            <b className="num">{v == null ? '–' : it.fmt(v)}</b>
            <span className={season.rankBar} aria-hidden="true"><i style={{ width: rk ? `${((n - rk + 1) / n) * 100}%` : 0 }} /></span>
            <span className={season.rank}>{rk ? `${ordinal(rk)}` : ''}</span>
          </div>
        )
      })}
      {xgp != null && <div className={season.stat}><span className={season.statK}>Andel av chanserna (xG)</span><b className="num">{pctTxt(xgp, 1)}</b><span /><span /></div>}
      {gax != null && <div className={season.stat}><span className={season.statK}>Mål över förväntat (xG)</span><b className="num">{(gax > 0 ? '+' : '') + dec(gax, 1)}</b><span /><span /></div>}
    </div>
  )
}

function Roster({ code }: { code: string }) {
  const { core, cur } = useData()
  const roster = core.rosters[code] || []
  if (!roster.length) return <Panel title="Trupp"><Empty>Truppen kunde inte hämtas.</Empty></Panel>
  const season = core.seasons[cur]
  const skStats = new Map(season.skaters.map((p) => [p.id, p])), gkStats = new Map(season.goalies.map((p) => [p.id, p]))
  const group = (pos: 'F' | 'D' | 'GK', title: string) => {
    const list = roster.filter((p) => pos === 'GK' ? p.pos === 'GK' : pos === 'D' ? p.pos === 'D' : !['GK', 'D'].includes(p.pos))
    if (!list.length) return null
    const val = (id: string) => (skStats.get(id)?.pts ?? gkStats.get(id)?.gpi ?? -1)
    return (
      <Panel title={`${title} (${list.length})`}>
        <div className="tscroll">
          <table className="t stick">
            <thead><tr><th className="l">Spelare</th>{pos === 'GK' ? <><th>SM</th><th>Rädd%</th><th>GAA</th><th>Nollor</th></> : <><th>SM</th><th>M</th><th>A</th><th>P</th><th>+/-</th><th>Istid</th></>}</tr></thead>
            <tbody>
              {[...list].sort((a, b) => val(b.id) - val(a.id)).map((p) => {
                const g = gkStats.get(p.id), s = skStats.get(p.id)
                return (
                  <tr key={p.id}>
                    <td className="l"><div className="pcell"><Avatar id={p.id} name={p.name} team={code} /><div><PlayerLink id={p.id} name={p.name} /><br /><small>#{p.num ?? '–'} · {NAT[p.nat || ''] || p.nat || ''}</small></div></div></td>
                    {pos === 'GK'
                      ? <><td>{g?.gpi ?? 0}</td><td className="hl">{g ? dec(g.svp, 2) : '–'}</td><td>{g ? dec(g.gaa, 2) : '–'}</td><td>{g?.so ?? 0}</td></>
                      : <><td>{s?.gp ?? 0}</td><td>{s?.g ?? 0}</td><td>{s?.a ?? 0}</td><td className="hl">{s?.pts ?? 0}</td><td>{s ? signed(s.pm) : '–'}</td><td>{s ? mmss(s.toi) : '–'}</td></>}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Panel>
    )
  }
  return (
    <Board>
      <Panel title="Projicerad uppställning" className="wide"><LineupGrid L={core.lineups[code]} code={code} absent /></Panel>
      {group('F', 'Forwards')}{group('D', 'Backar')}{group('GK', 'Målvakter')}
    </Board>
  )
}

function History({ code }: { code: string }) {
  const { core, games, cur, prev } = useData()
  const narrow = useNarrow()
  const W = useChartWidth(560)
  const past = [...core.seasonOrder].reverse().map((lab) => ({ lab, row: (core.pastStandings[lab] || []).find((x) => x.code === code) }))
  const H = 210, n = past.length, bw = (W - 40) / n, mx = Math.max(1, ...past.map((p) => p.row?.pts || 0))
  // Record against each opponent this season and last
  const vs: Record<string, { w: number; l: number }> = {}
  const add = (opp: string, won: boolean) => { const v = (vs[opp] ??= { w: 0, l: 0 }); if (won) v.w++; else v.l++ }
  for (const g of games.filter(isFinal)) if (g.home === code || g.away === code) add(g.home === code ? g.away : g.home, (g.home === code ? g.hs! : g.as!) > (g.home === code ? g.as! : g.hs!))
  for (const x of core.pastGames.filter((x) => x[0] === prev && (x[2] === code || x[3] === code))) add(x[2] === code ? x[3] : x[2], (x[2] === code ? x[4] : x[5]) > (x[2] === code ? x[5] : x[4]))
  const vsRows = Object.entries(vs).sort((a, b) => (b[1].w - b[1].l) - (a[1].w - a[1].l))
  return (
    <Board>
      <Panel title="Poäng per säsong">
        <div className="chart">
          <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Poäng per säsong">
            {past.map((p, i) => {
              const v = p.row?.pts || 0, h = v / mx * (H - 64), x = 20 + i * bw, curS = p.lab === cur
              return (
                <g key={p.lab}>
                  <rect x={x + 8} y={H - 38 - h} width={bw - 16} height={h} rx="4" style={{ fill: curS ? 'var(--accent)' : 'color-mix(in srgb, var(--accent) 45%, var(--faint))' }}><title>{`${p.lab}: ${v} poäng${p.row ? `, plats ${p.row.rank}` : ''}`}</title></rect>
                  <text x={x + bw / 2} y={H - 42 - h} textAnchor="middle" fontSize="13" fontWeight="700" style={{ fill: 'var(--text)' }}>{p.row ? v : '–'}</text>
                  <text x={x + bw / 2} y={H - 20} textAnchor="middle" fontSize="12" style={{ fill: 'var(--muted)' }}>{p.lab}{curS && !narrow ? ' (hittills)' : ''}</text>
                  <text x={x + bw / 2} y={H - 5} textAnchor="middle" fontSize="11" style={{ fill: 'var(--faint)' }}>{p.row ? `plats ${p.row.rank}` : 'ej i SHL'}</text>
                </g>
              )
            })}
          </svg>
        </div>
      </Panel>
      <Panel title="Tidigare säsonger">
        <div className="tscroll">
          <table className="t">
            <thead><tr><th className="l">Säsong</th><th>Plats</th><th>SM</th><th>V</th><th>ÖV</th><th>ÖF</th><th>F</th><th>GM–IM</th><th>P</th></tr></thead>
            <tbody>
              {past.slice().reverse().map((p) => p.row
                ? <tr key={p.lab}><td className="l">{p.lab}{p.lab === cur && <> <span className="faint">(pågår)</span></>}</td><td className="hl">{p.row.rank}</td><td>{p.row.gp}</td><td>{p.row.w}</td><td>{p.row.otw}</td><td>{p.row.otl}</td><td>{p.row.l}</td><td>{p.row.gf}–{p.row.ga}</td><td className="hl">{p.row.pts}</td></tr>
                : <tr key={p.lab}><td className="l">{p.lab}</td><td colSpan={8} className="l faint">Spelade inte i SHL</td></tr>)}
            </tbody>
          </table>
        </div>
      </Panel>
      <Panel title={`Mot varje lag, ${prev} och ${cur}`}>
        {vsRows.length ? (
          <div className="tscroll">
            <table className="t">
              <thead><tr><th className="l">Motstånd</th><th>V</th><th>F</th></tr></thead>
              <tbody>{vsRows.map(([c, v]) => <tr key={c}><td className="l"><TeamLink code={c} name /></td><td className={v.w > v.l ? 'hl' : undefined}>{v.w}</td><td>{v.l}</td></tr>)}</tbody>
            </table>
          </div>
        ) : <Empty>Inga matcher.</Empty>}
      </Panel>
    </Board>
  )
}
