import { useState, type ReactNode } from 'react'
import { HBars, LineChart } from '@/components/charts/Basic'
import { Board, RouteTabs, type TabDef } from '@/components/site/Layout'
import { Empty, Panel, Skeleton } from '@/components/site/Panel'
import { ClipCard, PlayerCardCompact, RefHero } from '@/components/site/Pieces'
import { TeamBadge, TeamLink } from '@/components/site/TeamBadge'
import { useData } from '@/data/context'
import { playersFile, useFile } from '@/data/loaders'
import { ageOf, dateParts, dec, fmtDate, fmtDay, mmss, POS_SHORT, signed, sum } from '@/lib/format'
import { ordinal, resultFor } from '@/lib/game'
import { playerCards } from '@/lib/cards'
import { NAT } from '@/lib/nat'
import { usePageTitle } from '@/lib/pageTitle'
import { gsaa } from '@/lib/stats'
import { teamHue, vivid } from '@/lib/teams'
import type { Goalie, PlayersData, Skater } from '@/lib/types'
import { useNarrow } from '@/lib/useNarrow'
import { NotFound } from './NotFound'

type Row = (string | number)[]
const n = (v: unknown) => +(v as number) || 0

export function SpelarePage({ id, tab }: { id: string; tab: string }) {
  const P = useFile(playersFile)
  if (P.state === 'loading') return <Skeleton />
  if (P.state === 'error') return <NotFound msg="Spelaren kunde inte laddas. Försök igen om en stund." />
  return <Player P={P.data} id={id} want={tab} />
}

function Player({ P, id, want }: { P: PlayersData; id: string; want: string }) {
  const { core, cur, gamesById, tName, teams, headshots } = useData()
  const narrow = useNarrow()
  const bio = P.bios[id]
  usePageTitle(bio?.name)
  if (!bio) return <NotFound msg="Spelaren hittades inte." />

  const gk = bio.pos === 'GK'
  const season = core.seasons[cur]
  const curP = (gk ? season.goalies : season.skaters).find((p) => p.id === id) as Skater | Goalie | undefined
  const team = curP?.team || bio.team
  const clips = P.goalClips?.[id] || []
  const log: Row[] = (gk ? P.goalieLogs[id] : P.gamelogs[id]) || []
  const careerRows: Row[] = (gk ? P.goalieCareer[id] : P.career[id]) || []
  // Phones have no Matchlogg tab: the games are rows on Översikt that open the game
  const tabList: TabDef[] = [{ key: '', label: 'Översikt' }, { key: 'karriar', label: 'Karriär' },
    ...(narrow ? [] : [{ key: 'matchlogg', label: 'Matchlogg', count: log.length || '' }]), ...(clips.length ? [{ key: 'mal', label: 'Målvideor', count: clips.length }] : [])]
  const tab = tabList.some((t) => t.key === want) ? want : ''
  const [first, ...rest] = String(bio.name).split(' ')

  // The profile-style top card (this season in the stats band)
  const chrono = [...careerRows].reverse() // oldest first
  const earlier: { code: string; from: string; to: string }[] = []
  for (const r of chrono) if (r[1] !== team) { const e = earlier.find((x) => x.code === r[1]); if (e) e.to = r[0] as string; else earlier.push({ code: r[1] as string, from: r[0] as string, to: r[0] as string }) }
  const yr = (s: string) => `20${s.slice(0, 2)}`, span = (e: { from: string; to: string }) => e.from === e.to ? yr(e.from) : `${yr(e.from)}–${String(+yr(e.to) + 1).slice(2)}`
  const facts: [string, ReactNode][] = [
    ...(bio.born ? [['Född', fmtDate(bio.born)] as [string, string]] : []),
    ['Nation', NAT[bio.nat || ''] || bio.nat || '–'],
    // Phones: just birth date and nation
    ...(chrono.length && !narrow ? [['SHL-debut', `${yr(chrono[0][0] as string)}/${String(chrono[0][0]).slice(-2)}`] as [string, string]] : []),
    ...(earlier.length && !narrow ? [['Tidigare', earlier.slice(-2).reverse().map((e) => `${e.code} ${span(e)}`).join(', ')] as [string, string]] : []),
  ]
  const cells = (p: Skater | Goalie): [string, ReactNode][] => gk
    ? [['SM', (p as Goalie).gpi], ['V', (p as Goalie).w_ ?? '–'], ['Rädd%', dec((p as Goalie).svp, 2)], ['GAA', dec((p as Goalie).gaa, 2)], ['Nollor', (p as Goalie).so], ['Räddn.', (p as Goalie).sv], ['GSAA', dec(gsaa(p as Goalie, season))]]
    : [['SM', (p as Skater).gp], ['M', (p as Skater).g], ['A', (p as Skater).a], ['P', (p as Skater).pts], ['P/M', dec((p as Skater).gp ? (p as Skater).pts / (p as Skater).gp : 0, 2)], ['+/-', signed((p as Skater).pm)], ['Utv', (p as Skater).pim], ['Skott', (p as Skater).sog], ['Istid', mmss((p as Skater).toi)]]

  const hero = (
    <RefHero bg={teams[team]?.logo} tc={vivid(teamHue(team))} photo={headshots[id]?.[1]} first={first} last={rest.join(' ')}
      badge={<><TeamBadge code={team} size="md" /><b>#{bio.num ?? '–'}</b><i /><b>{gk ? 'MV' : POS_SHORT[bio.pos] || 'F'}</b></>}
      big={[...(bio.h ? [['Längd', bio.h, 'cm']] : []), ...(bio.w ? [['Vikt', bio.w, 'kg']] : []), ...(bio.born ? [['Ålder', ageOf(bio.born), 'år']] : [])] as [string, ReactNode, string][]}
      facts={facts} rows={curP ? [{ label: `Grundserien ${cur.replace('-', '/')}`, cells: cells(curP) }] : []}
      tabs={<RouteTabs base={`/spelare/${encodeURIComponent(id)}`} tabs={tabList} active={tab} />} />
  )

  const gdate = (gid: string) => gamesById[gid] ? fmtDay(gamesById[gid].start) : ''
  const res = (gid: string, code: string) => {
    const g = gamesById[gid]
    if (!g) return null
    const r = resultFor(g, code), mine = g.home === code ? g.hs : g.as, th = g.home === code ? g.as : g.hs
    return <a href={`#/match/${gid}`}>{r === 'v' || r === 'ov' ? 'V' : 'F'} {mine}–{th}{g.ot || g.so ? ' ÖT' : ''}</a>
  }
  const svPct = (r: Row) => dec(n(r[5]) ? n(r[6]) / n(r[5]) * 100 : 0, 1)

  let body: ReactNode
  if (tab === 'karriar') body = <Career rows={careerRows} gk={gk} />
  else if (tab === 'matchlogg') {
    body = (
      <Panel title={`Matchlogg ${cur}`}>
        <div className="tscroll">
          {!log.length ? <Empty>Inga matcher den här säsongen.</Empty> : gk ? (
            <table className="t">
              <thead><tr><th className="l">Datum</th><th className="l">Motstånd</th><th className="l">Resultat</th><th>Skott</th><th>Räddn.</th><th>Insl.</th><th>Rädd%</th></tr></thead>
              <tbody>{[...log].reverse().map((r) => (
                <tr key={r[0]}><td className="l">{gdate(r[0] as string)}</td><td className="l">{r[3] ? 'mot' : 'på'} <TeamLink code={r[2] as string} name /></td><td className="l">{res(r[0] as string, r[1] as string)}</td><td>{r[5]}</td><td>{r[6]}</td><td>{r[4]}</td><td className="hl">{svPct(r)}</td></tr>
              ))}</tbody>
            </table>
          ) : (
            <table className="t">
              <thead><tr><th className="l">Datum</th><th className="l">Motstånd</th><th className="l">Resultat</th><th>M</th><th>A</th><th>P</th><th>+/-</th><th>Skott</th><th>Utv</th><th>Istid</th><th>Tackl.</th><th>Block</th></tr></thead>
              <tbody>{[...log].reverse().map((r) => (
                <tr key={r[0]}><td className="l">{gdate(r[0] as string)}</td><td className="l">{r[3] ? 'mot' : 'på'} <TeamLink code={r[2] as string} name /></td><td className="l">{res(r[0] as string, r[1] as string)}</td>
                  <td>{r[4]}</td><td>{r[5]}</td><td className="hl">{n(r[4]) + n(r[5])}</td><td>{signed(n(r[6]))}</td><td>{r[8]}</td><td>{r[9]}</td><td>{mmss(n(r[7]))}</td><td>{r[10]}</td><td>{r[11]}</td></tr>
              ))}</tbody>
            </table>
          )}
        </div>
      </Panel>
    )
  } else if (tab === 'mal') {
    body = (
      <Panel title={`Målvideor ${cur}`}>
        <div className="clips">{[...clips].reverse().map(([, cid, thumb, embed, date, opp]) => <ClipCard key={cid} c={{ id: cid, thumb, embed }} title={`Mot ${tName(opp)}`} sub={fmtDay(date)} />)}</div>
      </Panel>
    )
  } else {
    // Phones: this season only (no points chart or videos), and the games as rows that open the game
    const card = playerCards(core).get(id)
    let trend: ReactNode = null
    if (!narrow && !gk && log.length >= 2) {
      const pts = log.reduce<number[]>((acc, r) => [...acc, (acc[acc.length - 1] ?? 0) + n(r[4]) + n(r[5])], [])
      trend = (
        <Panel title="Poängutveckling" sub={`Ackumulerade poäng ${cur}.`}>
          <div className="chart"><LineChart series={[{ pts, color: 'var(--accent)', area: true }]} yFmt={(v) => Math.round(v)}
            xLabels={log.map((r) => { const g = gamesById[r[0] as string]; return g ? `${dateParts(g.start).d}/${dateParts(g.start).m}` : '' })} /></div>
        </Panel>
      )
    }
    const recent = narrow ? [] : clips.slice(-3).reverse()
    const last5 = [...log].slice(-5).reverse()
    const parts = [
      narrow && curP ? <SeasonCard key="season" p={curP} gk={gk} team={team} /> : null,
      card ? <Panel key="card" title="Spelarkort" sub={gk ? 'Percentiler jämfört med andra SHL-målvakter.' : 'Percentiler jämfört med andra SHL-spelare på samma position.'}><PlayerCardCompact x={card} /></Panel> : null,
      trend,
      recent.length ? (
        <Panel key="clips" title="Senaste målen" more={clips.length > 3 ? { href: `#/spelare/${encodeURIComponent(id)}/mal`, label: 'Alla mål' } : undefined}>
          <div className="clips">{recent.map(([, cid, thumb, embed, date, opp]) => <ClipCard key={cid} c={{ id: cid, thumb, embed }} title={`Mot ${tName(opp)}`} sub={fmtDay(date)} />)}</div>
        </Panel>
      ) : null,
      narrow ? (log.length ? <Panel key="games" title="Senaste matcherna"><GameRows log={log} gk={gk} /></Panel> : null)
        : last5.length ? (
          <Panel key="games" title="Senaste matcherna" more={{ href: `#/spelare/${encodeURIComponent(id)}/matchlogg`, label: 'Hela loggen' }}>
            <div className="tscroll">
              <table className="t">
                <thead><tr><th className="l">Datum</th><th className="l">Motstånd</th>{gk ? <th>Rädd%</th> : <><th>M</th><th>A</th><th>+/-</th></>}</tr></thead>
                <tbody>{last5.map((r) => (
                  <tr key={r[0]}><td className="l">{gdate(r[0] as string)}</td><td className="l"><TeamLink code={r[2] as string} name /></td>
                    {gk ? <td className="hl">{svPct(r)}</td> : <><td>{r[4]}</td><td>{r[5]}</td><td>{signed(n(r[6]))}</td></>}</tr>
                ))}</tbody>
              </table>
            </div>
          </Panel>
        ) : null,
    ].filter(Boolean)
    body = card || trend || recent.length || log.length
      ? <Board>{parts}</Board>
      : <Panel><Empty>Ingen statistik den här säsongen ännu.</Empty></Panel>
  }
  return <>{hero}{body}</>
}

// Phones: this season at a glance, per-game numbers and where the player ranks in the team and in the league
function SeasonCard({ p, gk, team }: { p: Skater | Goalie; gk: boolean; team: string }) {
  const { core, cur } = useData()
  const season = core.seasons[cur]
  const pool: (Skater | Goalie)[] = gk ? season.goalies.filter((x) => x.gpi >= Math.min(5, (p as Goalie).gpi)) : season.skaters
  const mates = pool.filter((x) => x.team === team)
  const place = (list: (Skater | Goalie)[], val: (x: never) => number, low?: boolean) => {
    const v = val(p as never)
    return ordinal(1 + list.filter((x) => (low ? val(x as never) < v : val(x as never) > v)).length)
  }
  const stats: [string, (x: never) => number, boolean?][] = gk
    ? [['Rädd%', (x: Goalie) => x.svp], ['GAA', (x: Goalie) => x.gaa, true], ['GSAA', (x: Goalie) => gsaa(x, season)]]
    : [['Poäng', (x: Skater) => x.pts], ['Mål', (x: Skater) => x.g], ['Assist', (x: Skater) => x.a]]
  // Numbers the stats band above doesn't already show
  const g = p as Goalie, s = p as Skater
  const tiles: [string, ReactNode][] = gk
    ? [['Vinst%', (g.w_ ?? 0) + (g.l ?? 0) ? dec((g.w_ ?? 0) / ((g.w_ ?? 0) + (g.l ?? 0)) * 100, 0) : '–'], ['Insläppta', g.ga], ['Minuter', Math.round(g.mins || 0)]]
    : [['Skott%', s.sog ? dec(s.g / s.sog * 100, 1) : '–'], ['PP-mål', s.ppg ?? 0], ['Avgörande', s.gwg ?? 0]]
  return (
    <Panel title={`Säsongen ${cur.replace('-', '/')}`}>
      <div className="ps-tiles">{tiles.map(([k, v]) => <div key={k}><span>{k}</span><b className="num">{v}</b></div>)}</div>
      <div className="ps-ranks">
        <div className="ps-r ps-rh"><span>Placering</span><span>I laget</span><span>I SHL</span></div>
        {stats.map(([k, val, low]) => <div key={k} className="ps-r"><span>{k}</span><b>{place(mates, val, low)}</b><b>{place(pool, val, low)}</b></div>)}
      </div>
    </Panel>
  )
}

// Phones: this season's games as rows; a tap opens the game. The five latest show, the rest behind a button
function GameRows({ log, gk }: { log: Row[]; gk: boolean }) {
  const { gamesById, tName } = useData()
  const [all, setAll] = useState(false)
  return (
    <>
      <div className="pg-list">
        {[...log].reverse().map((r, i) => {
          const g = gamesById[r[0] as string]
          if (!g) return null
          const code = r[1] as string, res = resultFor(g, code), win = res === 'v' || res === 'ov'
          const mine = g.home === code ? g.hs : g.as, th = g.home === code ? g.as : g.hs, dp = dateParts(g.start)
          return (
            <a key={r[0]} className="pg-row" href={`#/match/${r[0]}`} hidden={i >= 5 && !all}>
              <span className="pg-d">{dp.d}/{dp.m}</span>
              <span className="pg-opp"><TeamBadge code={r[2] as string} /><span><b>{tName(r[2] as string)}</b><small>{r[3] ? 'Hemma' : 'Borta'}</small></span></span>
              <span className={`pg-res ${win ? 'w' : 'l'}`}>{win ? 'V' : 'F'} {mine}–{th}{g.ot || g.so ? <> <small>ÖT</small></> : null}</span>
              <span className="pg-st">{gk
                ? <><b className="num">{dec(n(r[5]) ? n(r[6]) / n(r[5]) * 100 : 0, 1)}</b><small>Rädd%</small></>
                : <><b className="num">{r[4]}+{r[5]}</b><small>{signed(n(r[6]))}</small></>}</span>
            </a>
          )
        })}
      </div>
      {log.length > 5 && !all && <button className="pg-more" onClick={() => setAll(true)}>Visa alla {log.length} matcher</button>}
    </>
  )
}

// The SHL career season by season, the clubs played for, and points (or save %) per season
function Career({ rows, gk }: { rows: Row[]; gk: boolean }) {
  const { tName } = useData()
  if (!rows.length) return <Panel title="SHL-karriär"><Empty>Ingen SHL-statistik hittades för spelaren.</Empty></Panel>
  const col = (i: number) => rows.map((r) => n(r[i]))
  const tot = (i: number) => sum(col(i))
  // Each stat's best season gets highlighted (only when there is more than one season to compare)
  const bestOf = (i: number, low = false) => {
    if (rows.length < 2) return null
    const v = col(i).filter((_, k) => !low || n(rows[k][2]) >= 10)
    return v.length ? (low ? Math.min(...v) : Math.max(...v)) : null
  }
  const Cell = ({ v, shown, best, cls = '' }: { v: number; shown: ReactNode; best: number | null; cls?: string }) =>
    <td className={[cls, best !== null && v === best && v !== 0 ? 'best' : ''].filter(Boolean).join(' ') || undefined}>{shown}</td>

  let table: ReactNode
  if (gk) {
    const sv = tot(3), ga = tot(4), mins = tot(10)
    const b = { gp: bestOf(2), sv: bestOf(3), svp: bestOf(5), gaa: bestOf(6, true), so: bestOf(7), w: bestOf(8) }
    table = (
      <table className="t">
        <thead><tr><th className="l">Säsong</th><th className="l">Lag</th><th>SM</th><th>Räddn.</th><th>Insl.</th><th>Rädd%</th><th>GAA</th><th>Nollor</th><th>V</th><th>F</th></tr></thead>
        <tbody>
          {rows.map((r, k) => (
            <tr key={k}><td className="l">{r[0]}</td><td className="l"><TeamLink code={r[1] as string} name /></td>
              <Cell v={n(r[2])} shown={r[2]} best={b.gp} /><Cell v={n(r[3])} shown={r[3]} best={b.sv} /><td>{r[4]}</td>
              {n(r[2]) >= 10 ? <Cell v={n(r[5])} shown={dec(n(r[5]), 2)} best={b.svp} cls="hl" /> : <td className="hl">{dec(n(r[5]), 2)}</td>}
              {n(r[2]) >= 10 ? <Cell v={n(r[6])} shown={dec(n(r[6]), 2)} best={b.gaa} /> : <td>{dec(n(r[6]), 2)}</td>}
              <Cell v={n(r[7])} shown={r[7]} best={b.so} /><Cell v={n(r[8])} shown={r[8] ?? '–'} best={b.w} /><td>{r[9] ?? '–'}</td></tr>
          ))}
          {rows.length > 1 && (
            <tr className="total"><td className="l"><b>Totalt</b></td><td></td><td><b>{tot(2)}</b></td><td><b>{sv}</b></td><td><b>{ga}</b></td>
              <td className="hl">{sv + ga ? dec(sv / (sv + ga) * 100, 2) : '–'}</td><td><b>{mins ? dec(ga * 60 / mins, 2) : '–'}</b></td><td><b>{tot(7)}</b></td><td><b>{tot(8)}</b></td><td><b>{tot(9)}</b></td></tr>
          )}
        </tbody>
      </table>
    )
  } else {
    const gp = tot(2)
    const b = { gp: bestOf(2), g: bestOf(3), a: bestOf(4), p: bestOf(5), pm: bestOf(6), sog: bestOf(8), ppg: bestOf(10) }
    table = (
      <table className="t">
        <thead><tr><th className="l">Säsong</th><th className="l">Lag</th><th>SM</th><th>M</th><th>A</th><th>P</th><th>P/M</th><th>+/-</th><th>Utv</th><th>PPM</th><th>Skott</th><th>Istid</th></tr></thead>
        <tbody>
          {rows.map((r, k) => (
            <tr key={k}><td className="l">{r[0]}</td><td className="l"><TeamLink code={r[1] as string} name /></td>
              <Cell v={n(r[2])} shown={r[2]} best={b.gp} /><Cell v={n(r[3])} shown={r[3]} best={b.g} /><Cell v={n(r[4])} shown={r[4]} best={b.a} /><Cell v={n(r[5])} shown={r[5]} best={b.p} cls="hl" />
              <td>{dec(n(r[2]) ? n(r[5]) / n(r[2]) : 0, 2)}</td><Cell v={n(r[6])} shown={signed(n(r[6]))} best={b.pm} /><td>{r[7]}</td>
              <Cell v={n(r[10])} shown={r[10] ?? '–'} best={b.ppg} /><Cell v={n(r[8])} shown={r[8]} best={b.sog} /><td>{mmss(n(r[9]))}</td></tr>
          ))}
          {rows.length > 1 && (
            <tr className="total"><td className="l"><b>Totalt</b></td><td></td><td><b>{gp}</b></td><td><b>{tot(3)}</b></td><td><b>{tot(4)}</b></td><td className="hl">{tot(5)}</td>
              <td><b>{gp ? dec(tot(5) / gp, 2) : '–'}</b></td><td><b>{signed(tot(6))}</b></td><td><b>{tot(7)}</b></td><td><b>{tot(10)}</b></td><td><b>{tot(8)}</b></td><td></td></tr>
          )}
        </tbody>
      </table>
    )
  }
  // Teams played for, most recent first, with their season spans
  const clubs = new Map<string, { code: string; from: string; to: string; n: number; gp: number; v: number }>()
  for (const r of [...rows].reverse()) {
    const c = clubs.get(r[1] as string) || { code: r[1] as string, from: r[0] as string, to: r[0] as string, n: 0, gp: 0, v: 0 }
    c.to = r[0] as string; c.n++; c.gp += n(r[2]); c.v += gk ? n(r[7]) : n(r[5])
    clubs.set(r[1] as string, c)
  }
  const chrono = [...rows].reverse()
  const seasonTxt = (c: { from: string; to: string }) => c.from === c.to ? c.from.replace('-', '/') : `${c.from.replace('-', '/')} – ${c.to.replace('-', '/')}`
  return (
    <Board>
      <Panel title="SHL-karriär" className="wide" sub="Grundserien i SHL säsong för säsong. Färgad siffra = bästa säsongen i den kategorin.">
        <div className="tscroll">{table}</div>
      </Panel>
      <Panel title="Klubbar i SHL">
        <ul className="clubs">
          {[...clubs.values()].reverse().map((c) => (
            <li key={c.code}>
              <a href={`#/lag/${c.code}`}><TeamBadge code={c.code} size="md" /></a>
              <div><a href={`#/lag/${c.code}`}><b>{tName(c.code)}</b></a><span>{seasonTxt(c)} · {c.n} {c.n === 1 ? 'säsong' : 'säsonger'}</span></div>
              <span className="clubs-v"><b>{c.gp}</b> SM · <b>{c.v}</b> {gk ? 'nollor' : 'p'}</span>
            </li>
          ))}
        </ul>
      </Panel>
      {rows.length > 1 && (
        <Panel title={gk ? 'Räddningsprocent per säsong' : 'Poäng per säsong'} sub={gk ? 'Säsonger med färre än 10 matcher säger mindre.' : 'Grundserien, äldst överst.'}>
          <div className="chart">
            {gk
              ? <LineChart series={[{ pts: chrono.map((r) => Math.max(80, n(r[5]))), color: 'var(--accent)' }]} xLabels={chrono.map((r) => r[0] as string)} yFmt={(v) => dec(v, 1)}
                  yMin={Math.max(80, Math.floor(Math.min(...chrono.map((r) => n(r[5]) || 100)) - 1))} yMax={Math.min(100, Math.ceil(Math.max(...chrono.map((r) => n(r[5]))) + 1))} />
              : <HBars items={chrono.map((r) => ({ label: `${r[0]} ${r[1]}`, v: n(r[5]) }))} fmt={(v) => v} labelW={110} />}
          </div>
        </Panel>
      )}
    </Board>
  )
}
