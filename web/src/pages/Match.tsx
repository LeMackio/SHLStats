import { useEffect, useState, type ReactNode } from 'react'
import { FeedCard } from '@/components/match/Feed'
import { Cmp, CmpRow, GoalList, MatchEvents, MatchPlayers, MatchVideo, Momentum, Recap, TeamCompare, WinChart } from '@/components/match/MatchParts'
import { Board, RouteTabs, type TabDef } from '@/components/site/Layout'
import { Empty, Panel, Skeleton } from '@/components/site/Panel'
import { FormChips, LineupGrid } from '@/components/site/Pieces'
import { Avatar, PlayerLink, TeamBadge, TeamLink } from '@/components/site/TeamBadge'
import { TeamToggle } from '@/components/site/TeamToggle'
import { useTeamSide } from '@/lib/pageState'
import { useData } from '@/data/context'
import { liveDetails, loadGame } from '@/data/games'
import { useOfficialLineup } from '@/data/lineups'
import { LIVE_API, liveClock, loadLive, type LiveData } from '@/data/live'
import { dateParts, dec, fmtDate, fmtDay, fmtTime, oddsTxt, pctTxt, sum } from '@/lib/format'
import { statusTxt } from '@/lib/game'
import { expectedGoals } from '@/lib/match'
import { usePageTitle } from '@/lib/pageTitle'
import { zoneBad } from '@/lib/stats'
import { pairColors, teamHue, vivid } from '@/lib/teams'
import { isFinal, isLive, type Game, type GameDetails } from '@/lib/types'
import { useNarrow } from '@/lib/useNarrow'
import { NotFound } from './NotFound'

export function MatchPage({ id, tab }: { id: string; tab: string }) {
  const { gamesById } = useData()
  const g = gamesById[id]
  usePageTitle(g ? `${g.home}–${g.away}` : null)
  if (!g) return <NotFound msg="Matchen hittades inte." />
  return <Match g={g} want={tab} />
}

// A played game's data, and while it is being played the relay's live data on top (refreshed every 6 seconds)
function useMatchData(g: Game) {
  const { core, cur } = useData()
  const done = isFinal(g), live = isLive(g)
  const [base, setBase] = useState<{ ready: boolean; d: GameDetails | null }>({ ready: !(done || live), d: null })
  // tried: the relay has answered (or failed) at least once, so the first draw already shows the live state
  const [live$, setLive] = useState<{ tried: boolean; L: LiveData | null }>({ tried: false, L: null })
  useEffect(() => {
    if (!done && !live) return
    let off = false
    loadGame(g.id).then((d) => { if (!off) setBase({ ready: true, d }) })
    return () => { off = true }
  }, [g.id, done, live])
  useEffect(() => {
    if (!live || !LIVE_API) return
    let off = false
    const tick = () => loadLive(g.id, 0).then((x) => { if (!off) setLive((p) => ({ tried: true, L: x ? { ...x } : p.L })) })
    tick()
    const t = setInterval(() => { if (!document.hidden) tick() }, 6000)
    return () => { off = true; clearInterval(t) }
  }, [g.id, live])
  const L = live$.L
  const d = live && L ? liveDetails(g, L, base.d, core.seasons[cur]) : base.d
  return { ready: base.ready && (!live || !LIVE_API || live$.tried), d }
}

function Match({ g, want }: { g: Game; want: string }) {
  const { core, cur, tName } = useData()
  const narrow = useNarrow()
  const done = isFinal(g), live = isLive(g)
  const { ready, d } = useMatchData(g)
  const official = useOfficialLineup(g, core.seasons[cur], (!done && !live && want === 'uppstallning') || (live && want === 'spelare' && narrow && !d?.box?.home?.length))

  if (!ready) return <Skeleton />
  // During a game the score comes from the live data
  const hs = live && d ? d.hs : g.hs, as = live && d ? d.as : g.as
  const base = `/match/${g.id}`
  // Played and live games: phones show the line-ups at the bottom of Spelarstatistik; video is always last
  const tabs: TabDef[] = done || live
    ? [{ key: '', label: 'Översikt' }, { key: 'spelare', label: 'Spelarstatistik' }, { key: 'skott', label: 'Händelser' },
      { key: 'video', label: 'Video', count: d ? d.goals.filter((x) => x.clip).length + (d.hl ? 1 : 0) || '' : '' }]
    : [{ key: '', label: 'Preview' }, { key: 'uppstallning', label: 'Uppställningar' }]
  const tab = tabs.some((t) => t.key === want) ? want : ''
  const meta = [`${fmtDay(g.start)} ${dateParts(g.start).y}, ${fmtTime(g.start)}`, d?.arena || g.arena, d?.att ? `Publik ${d.att.toLocaleString('sv-SE')}` : ''].filter(Boolean) as string[]
  const [hc, ac] = pairColors(g.home, g.away)
  const rec = (c: string) => {
    const i = core.standings.findIndex((t) => t.code === c)
    return i >= 0 ? <span className="mh-rec"><span className="gc-rank" style={{ '--zone': zoneBad(i + 1) } as React.CSSProperties}>{i + 1}</span>{core.standings[i].pts} p</span> : null
  }
  const team = (c: string, side: string) => (
    <a className="mteam" href={`#/lag/${c}`}><span className="mh-side">{side}</span><TeamBadge code={c} size="xl" /><b>{tName(c)}</b>{rec(c)}</a>
  )

  let body: ReactNode
  if (done || live) {
    if (!d) body = <Panel title="Matchfakta"><Empty>Detaljerad matchdata finns inte för den här matchen ännu. Den hämtas vid nästa uppdatering.</Empty></Panel>
    else body = tab === 'video' ? <MatchVideo d={d} /> : tab === 'spelare' ? <MatchPlayers d={d} official={official} /> : tab === 'skott' ? <MatchEvents d={d} /> : <Summary d={d} done={done} />
  } else body = tab === 'uppstallning' ? <LineupTab g={g} official={official} /> : <Preview g={g} />

  return (
    <>
      <section className="panel mpanel" style={{ '--hc': hc, '--ac': ac, '--hb': vivid(teamHue(g.home)), '--ab': vivid(teamHue(g.away)) } as React.CSSProperties}>
        <div className="band">
          <div className="crumbs" style={{ padding: '16px 22px 0' }}><a href="#/matcher">Matcher</a> / {tName(g.home)} – {tName(g.away)}</div>
          <div className="mhead" style={{ '--n': Math.max(tName(g.home).length, tName(g.away).length) } as React.CSSProperties}>
            {team(g.home, 'Hemma')}
            <div className="mscore">
              {done || live ? <div className="sc">{hs}–{as}</div> : <div className="sc sm">{fmtTime(g.start)}</div>}
              <div className={`st ${live ? 'live' : ''}`}>{done ? statusTxt(g) : live ? <><i className="live-dot" />{liveClock(d?.live ?? null)}</> : fmtDay(g.start)}</div>
            </div>
            {team(g.away, 'Borta')}
          </div>
        </div>
        <div className="mmeta" style={{ paddingTop: 14 }}>{meta.map((m) => <span key={m}>{m}</span>)}</div>
        <RouteTabs base={base} tabs={tabs} active={tab} />
      </section>
      {body}
    </>
  )
}

function Summary({ d, done }: { d: GameDetails; done: boolean }) {
  const { core } = useData()
  return (
    <Board>
      {d.live && <FeedCard d={d} />}
      {/* During a game the goals card appears with the first goal (the clock is in the header above) */}
      {!(d.live && !d.goals.length) && <Panel title="Mål"><GoalList d={d} /></Panel>}
      <Panel title="Lagstatistik"><TeamCompare d={d} /></Panel>
      {done && <Recap d={d} />}
      {(d.shots?.length || d.live) && (
        <Panel title="Matchbild" className="wide" sub={d.live ? 'Skott på mål minut för minut, uppdateras under matchen.' : 'Skott på mål minut för minut.'}><Momentum d={d} /></Panel>
      )}
      {/* The win chance only while the game is on */}
      {core.model && d.live && (
        <Panel title="Vinstchans live" className="wide wp-card" sub="Uppdateras under matchen. Bygger på lagens styrka, ställningen och tiden som är kvar."><WinChart d={d} /></Panel>
      )}
    </Board>
  )
}

// The line-up card for a coming game: one team at a time, with a label that says whether it is the real line-up yet
function LineupTab({ g, official }: { g: Game; official: { home: import('@/lib/types').Lineup; away: import('@/lib/types').Lineup } | null }) {
  const { core } = useData()
  const [side, setSide] = useTeamSide()
  return (
    <Board>
      <Panel title={<>Uppställning <span className={`lu-status ${official ? 'ok' : ''}`}>{official ? 'Officiell' : 'Trolig'}</span></>} className="wide">
        <TeamToggle home={g.home} away={g.away} side={side} setSide={setSide} panes={{
          home: <div data-lineup="home"><LineupGrid L={official?.home || core.lineups[g.home]} code={g.home} /></div>,
          away: <div data-lineup="away"><LineupGrid L={official?.away || core.lineups[g.away]} code={g.away} /></div>,
        }} />
      </Panel>
    </Board>
  )
}

function Preview({ g }: { g: Game }) {
  const { core, cur } = useData()
  const ph = g.ph ?? 0.5
  const [lh, la] = expectedGoals(core.model, g.home, g.away)
  const pmf = (l: number) => { const o: number[] = []; let p = Math.exp(-l); for (let k = 0; k < 10; k++) { o.push(p); p *= l / (k + 1) } return o }
  const a = pmf(lh), b = pmf(la)
  const tie = sum(a.map((x, i) => x * b[i]))
  const row = (c: string) => core.standings.find((t) => t.code === c) || { gp: 0, pts: 0, gf: 0, ga: 0 }
  const T = (c: string) => core.teamStats[c] || ({} as Record<string, number>)
  const per = (x: number | undefined, gp: number | undefined) => gp ? x! / gp : null
  const H = row(g.home), A = row(g.away), TH = T(g.home), TA = T(g.away)
  const [hc, ac] = pairColors(g.home, g.away)
  const cmp = (label: string, h: number | null, av: number | null, fmt: (v: number) => string = (v) => dec(v, 2), lowerBetter = false) =>
    <CmpRow key={label} label={label} h={h == null ? '–' : fmt(h)} a={av == null ? '–' : fmt(av)} hv={h ?? 0} av={av ?? 0} lowerBetter={lowerBetter} />
  const topScorers = (c: string) => core.seasons[cur].skaters.filter((p) => p.team === c).sort((x, y) => y.pts - x.pts || y.g - x.g).slice(0, 4)
  const hot = (c: string) => (
    <div style={{ display: 'grid', gap: 8 }}>
      <div className="row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}><TeamLink code={c} name /><FormChips code={c} /></div>
      <ol className="lb">
        {topScorers(c).map((p, i) => (
          <li key={p.id}><span className="r">{i + 1}.</span><TeamBadge code={c} /><Avatar id={p.id} name={p.name} team={c} /><span className="n"><PlayerLink id={p.id} name={p.name} /></span><span className="v">{p.g}+{p.a}</span></li>
        ))}
        {!topScorers(c).length && <li className="faint">Ingen statistik ännu.</li>}
      </ol>
    </div>
  )
  return (
    <Board>
      <Panel title="Vinstchans">
        <div className="wc" style={{ '--hc': hc, '--ac': ac } as React.CSSProperties}>
          <div className="wc-row">
            <div className="wc-team"><TeamBadge code={g.home} size="lg" /><span className="wc-code">{g.home}</span><b className="num">{pctTxt(ph)}</b></div>
            <div className="wc-mid"><span>Övertid</span><b className="num">{pctTxt(tie)}</b></div>
            <div className="wc-team"><TeamBadge code={g.away} size="lg" /><span className="wc-code">{g.away}</span><b className="num">{pctTxt(1 - ph)}</b></div>
          </div>
          <div className="rx-track wc-track"><i style={{ width: `${ph * 100}%` }} /><i style={{ width: `${(1 - ph) * 100}%` }} /></div>
          <div className="wc-foot"><span>Förväntade mål</span><b className="num">{dec(lh, 1)} – {dec(la, 1)}</b><span className="faint">Övertid = lika efter 60 minuter</span></div>
        </div>
      </Panel>
      <Panel title="Säsongsjämförelse">
        <Cmp home={g.home} away={g.away}>
          {cmp('Poäng per match', per(H.pts, H.gp), per(A.pts, A.gp))}
          {cmp('Gjorda mål per match', per(H.gf, H.gp), per(A.gf, A.gp))}
          {cmp('Insläppta mål per match', per(H.ga, H.gp), per(A.ga, A.gp), undefined, true)}
          {cmp('Skott per match', per(TH.sog, TH.gp), per(TA.sog, TA.gp), (v) => dec(v, 1))}
          {cmp('Powerplay', TH.ppo ? TH.ppg / TH.ppo : null, TA.ppo ? TA.ppg / TA.ppo : null, (v) => pctTxt(v))}
          {cmp('Boxplay', TH.pko ? 1 - TH.ppga / TH.pko : null, TA.pko ? 1 - TA.ppga / TA.pko : null, (v) => pctTxt(v))}
          {cmp('Projicerade poäng', core.sim[g.home]?.proj ?? null, core.sim[g.away]?.proj ?? null, (v) => dec(v, 0))}
          {cmp('Slutspelschans', core.sim[g.home]?.top10 ?? null, core.sim[g.away]?.top10 ?? null, (v) => oddsTxt(v))}
        </Cmp>
      </Panel>
      <Panel title="Form och poängbästa"><div style={{ display: 'grid', gap: 18 }}>{hot(g.home)}{hot(g.away)}</div></Panel>
      <H2H g={g} />
    </Board>
  )
}

// Head to head this season and in earlier seasons
function H2H({ g }: { g: Game }) {
  const { core, games, cur } = useData()
  const both = (a: string, b: string) => [a, b].includes(g.home) && [a, b].includes(g.away)
  const meet = [
    ...games.filter((x) => isFinal(x) && both(x.home, x.away)).map((x) => ({ s: cur, d: x.start.slice(0, 10), home: x.home, away: x.away, hs: x.hs!, as: x.as!, ex: x.ot || x.so, id: x.id as string | undefined })),
    ...core.pastGames.filter((x) => both(x[2], x[3])).map((x) => ({ s: x[0], d: x[1], home: x[2], away: x[3], hs: x[4], as: x[5], ex: !!x[6], id: undefined })),
  ].sort((x, y) => y.d.localeCompare(x.d))
  if (!meet.length) return <Panel title="Inbördes möten"><Empty>Lagen har inte mötts i SHL de senaste säsongerna.</Empty></Panel>
  const winsOf = (c: string) => meet.filter((m) => (m.home === c ? m.hs > m.as : m.as > m.hs)).length
  const goalsOf = (c: string) => sum(meet.map((m) => m.home === c ? m.hs : m.as))
  return (
    <>
      <Panel title="Inbördes möten">
        <div className="tiles">
          <div className="tile"><span className="k">{g.home} vinster</span><span className="v">{winsOf(g.home)}</span><span className="s">{goalsOf(g.home)} gjorda mål</span></div>
          <div className="tile"><span className="k">{g.away} vinster</span><span className="v">{winsOf(g.away)}</span><span className="s">{goalsOf(g.away)} gjorda mål</span></div>
          <div className="tile"><span className="k">Möten</span><span className="v">{meet.length}</span><span className="s">sedan {meet[meet.length - 1].s}</span></div>
        </div>
      </Panel>
      <Panel title="Alla möten" className="wide">
        <div className="tscroll">
          <table className="t">
            <thead><tr><th className="l">Säsong</th><th className="l">Datum</th><th className="l">Hemma</th><th>Resultat</th><th className="l">Borta</th></tr></thead>
            <tbody>
              {meet.map((m, i) => (
                <tr key={i}>
                  <td className="l">{m.s}</td><td className="l">{fmtDate(m.d)}</td><td className="l"><TeamLink code={m.home} name /></td>
                  <td className="hl">{m.id ? <a href={`#/match/${m.id}`}>{m.hs}–{m.as}</a> : `${m.hs}–${m.as}`}{m.ex && <> <span className="faint">ÖT</span></>}</td>
                  <td className="l"><TeamLink code={m.away} name /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  )
}
