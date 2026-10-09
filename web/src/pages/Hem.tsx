import { useEffect, useState, type ReactNode } from 'react'
import { HBars } from '@/components/charts/Basic'
import { GameCard, GameRow } from '@/components/site/Games'
import { Seg } from '@/components/site/Layout'
import { Empty, MoreLink, Panel, Skeleton } from '@/components/site/Panel'
import { ClipCard, FormChips, LeaderList, NewsBox, TeamNewsCards } from '@/components/site/Pieces'
import { Legend, StandingsTable } from '@/components/site/Standings'
import { Avatar, TeamBadge } from '@/components/site/TeamBadge'
import { useData } from '@/data/context'
import { detailsFor } from '@/data/games'
import { teamsFile, useFile } from '@/data/loaders'
import { dateParts, DAYS, dec, fmtDay, fmtTime, oddsTxt, pctTxt, store, sum, todayStr } from '@/lib/format'
import { goalieMinGp, gsaa, zoneBad } from '@/lib/stats'
import { tColor } from '@/lib/teams'
import { isFinal, isLive, type Game, type GameDetails, type Goalie, type Skater } from '@/lib/types'
import { useNarrow } from '@/lib/useNarrow'

export function HemPage() {
  return useNarrow() ? <PhoneHome /> : <Overview />
}

// Computers: news and your team on top, then the table and top lists, games, highlights and the season odds
function Overview() {
  const { core, games, codes, cur, tName, stamp } = useData()
  const today = todayStr()
  const upcoming = games.filter((g) => !isFinal(g)), finals = games.filter(isFinal)
  const lastDate = finals[finals.length - 1]?.start.slice(0, 10)
  const lastGames = finals.filter((g) => g.start.slice(0, 10) === lastDate)
  // Upcoming games by day, whole days only, until the card roughly matches the results card beside it
  const comingDays: [string, Game[]][] = []
  for (const g of upcoming) {
    const d = g.start.slice(0, 10), last = comingDays[comingDays.length - 1]
    if (last && last[0] === d) last[1].push(g)
    else if (sum(comingDays.map((x) => x[1].length)) < Math.max(lastGames.length, 5)) comingDays.push([d, [g]])
    else break
  }
  const season = core.seasons[cur], gmin = goalieMinGp(season.goalies)
  const gold = codes.map((c) => ({ label: tName(c), code: c, v: core.sim[c].gold })).sort((a, b) => b.v - a.v)
  const race = codes.map((c) => ({ label: tName(c), code: c, v: core.sim[c].top10 })).sort((a, b) => b.v - a.v)
  const hls = (core.highlights || []).slice(0, 6)

  const [tableMode, setTableModeState] = useState<'stats' | 'proj'>(() => (store.get('shlstats-ovtable') === 'proj' ? 'proj' : 'stats'))
  const setTableMode = (v: 'stats' | 'proj') => { setTableModeState(v); store.set('shlstats-ovtable', v) }
  const [skStat, setSkStat] = useState<'pts' | 'g' | 'a'>('pts')
  const [gkStat, setGkStat] = useState<'svp' | 'gaa' | 'gsaa'>('svp')

  const SK: Record<typeof skStat, [(p: Skater) => number, (p: Skater) => number]> = {
    pts: [(p) => p.pts * 1000 + p.g, (p) => p.pts], g: [(p) => p.g * 1000 + p.pts, (p) => p.g], a: [(p) => p.a * 1000 + p.pts, (p) => p.a],
  }
  const GK: Record<typeof gkStat, [(g: Goalie) => number, (g: Goalie) => string]> = {
    svp: [(g) => g.svp, (g) => dec(g.svp, 2)],
    gaa: [(g) => -g.gaa, (g) => dec(g.gaa, 2)],
    gsaa: [(g) => gsaa(g, season), (g) => { const v = gsaa(g, season); return (v > 0 ? '+' : '') + dec(v) }],
  }
  const [skOrder, skVal] = SK[skStat], [gkOrder, gkFmt] = GK[gkStat]

  return (
    <>
      <section className="panel mday newshero"><div className="mday-grid"><NewsBox /><MyTeamSide /></div></section>
      {/* Rows of cards; cards in the same row always share the same height */}
      <div className="ov-row r-leaders">
        <Panel title="Tabell" extra={<Seg id="ov-table-mode" value={tableMode} onChange={setTableMode} options={[['stats', 'Tabell'], ['proj', 'Odds']]} />}
          foot={<><MoreLink href="#/tabell">Hela tabellen</MoreLink><span className="stamp">Uppdaterad {stamp}</span></>}>
          {/* Both versions are drawn on top of each other and only one is shown, so switching never changes the card's size */}
          <div id="ov-table" className="ov-tstack">
            {(['stats', 'proj'] as const).map((m) => (
              <div key={m} data-mode={m} className={m === tableMode ? undefined : 'off'} aria-hidden={m === tableMode ? undefined : true}><StandingsTable mode={m} /></div>
            ))}
          </div>
          <Legend />
        </Panel>
        <Panel title="Spelare" extra={<Seg id="ov-sk-stat" value={skStat} onChange={setSkStat} options={[['pts', 'Poäng'], ['g', 'Mål'], ['a', 'Assist']]} />}
          foot={<MoreLink href="#/statistik">All statistik</MoreLink>}>
          <div id="ov-sk" className="fill">
            <LeaderList rows={[...season.skaters].sort((a, b) => skOrder(b) - skOrder(a))} val={skVal} avatars={false} sub={(p) => `${p.g}+${p.a} på ${p.gp} matcher`} />
          </div>
        </Panel>
        <Panel title="Målvakter" extra={<Seg id="ov-gk-stat" value={gkStat} onChange={setGkStat} options={[['svp', 'Rädd%'], ['gaa', 'GAA'], ['gsaa', 'GSAA']]} />}
          foot={<><MoreLink href="#/statistik">Alla målvakter</MoreLink><span className="stamp">Minst {gmin} matcher</span></>}>
          <div id="ov-gk" className="fill">
            <LeaderList rows={season.goalies.filter((g) => g.gpi >= gmin).sort((a, b) => gkOrder(b) - gkOrder(a))} val={(g) => g} fmt={gkFmt} avatars={false} sub={(g) => `${g.gpi} matcher`} />
          </div>
        </Panel>
      </div>
      <div className="ov-row r-two">
        <Panel title="Kommande matcher" more={{ href: '#/matcher', label: 'Alla matcher' }}>
          {comingDays.length ? comingDays.map(([d, gs]) => (
            <div className="day" key={d}><h3>{d === today ? 'Idag' : fmtDay(d)}</h3>{gs.map((g) => <GameRow key={g.id} g={g} />)}</div>
          )) : <Empty>Inga fler matcher i grundserien.</Empty>}
        </Panel>
        <Panel title="Senaste resultat" more={{ href: '#/matcher/spelade', label: 'Alla resultat' }}>
          {lastGames.length ? <div className="day"><h3>{fmtDay(lastDate)}</h3>{lastGames.map((g) => <GameRow key={g.id} g={g} />)}</div> : <Empty>Inga spelade matcher ännu.</Empty>}
        </Panel>
      </div>
      {hls.length > 0 && (
        <div className="ov-row r-one">
          <Panel title="Matchsammandrag">
            <div className="clips six">{hls.map((h) => <ClipCard key={h.gid} c={h} title={`${h.home} ${h.hs}–${h.as} ${h.away}`} sub={fmtDay(h.date)} />)}</div>
          </Panel>
        </div>
      )}
      <div className="ov-row r-two">
        <Panel title="Slutspelsstrecket" sub="Chans att sluta topp 10 och nå slutspel.">
          <div className="chart"><HBars items={race} max={1} labelW={140} logos color={(it) => (it.v >= 0.5 ? 'var(--accent)' : 'var(--bad)')} /></div>
        </Panel>
        <Panel title="Chans till SM-guld" sub="Andel av 10 000 simuleringar där laget vinner SM-finalen." more={{ href: '#/tabell', label: 'Alla odds' }}>
          <div className="chart"><HBars items={gold} labelW={140} logos /></div>
        </Panel>
      </div>
    </>
  )
}

// Your team next to the news (computers), built like the team page hero: club-colour header with the logo large,
// then form, the season odds, the last result and the next three games with the win chance. Or a team picker.
function MyTeamSide() {
  const { core, games, codes, tName, fav, setFav, teams } = useData()
  const f = fav && core.sim[fav] ? fav : null
  if (!f) {
    return (
      <div className="mday-side">
        <span className="mini-lbl">Följ ditt lag</span>
        <p className="muted" style={{ margin: 0, fontSize: 14 }}>Välj ett lag så visas dess tabellplats, odds och matcher här, och lagets matcher lyfts fram över hela sajten.</p>
        <div className="pickteams sm">
          {[...codes].sort((a, b) => tName(a).localeCompare(tName(b), 'sv')).map((c) => (
            <button key={c} title={`Följ ${tName(c)}`} aria-label={`Följ ${tName(c)}`} onClick={() => setFav(c)}><TeamBadge code={c} size="md" /></button>
          ))}
        </div>
      </div>
    )
  }
  const r = core.standings.find((t) => t.code === f)!, s = core.sim[f]
  const mine = (x: Game) => x.home === f || x.away === f
  const last = [...games].reverse().find((x) => isFinal(x) && mine(x))
  const coming = games.filter((x) => !isFinal(x) && mine(x)).slice(0, 3)
  const line = (g: Game) => {
    const home = g.home === f, opp = home ? g.away : g.home, p = dateParts(g.start)
    let right: ReactNode
    if (isFinal(g)) {
      const us = (home ? g.hs : g.as)!, them = (home ? g.as : g.hs)!, won = us > them
      right = <span className="mts-res num"><i className={won ? 'w' : 'l'}>{won ? 'V' : 'F'}</i>{us}–{them}{g.ot || g.so ? <small>ÖT</small> : null}</span>
    } else if (isLive(g)) right = <span className="tag bad">LIVE</span>
    else right = <span className="mts-pct num" title="Vinstchans">{pctTxt(home ? g.ph ?? 0.5 : 1 - (g.ph ?? 0.5))}</span>
    return (
      <a key={g.id} className="mts-g" href={`#/match/${g.id}`}>
        <span className="mts-d">{DAYS[p.wd]} {p.d}/{p.m}{!isFinal(g) && <small>{fmtTime(g.start)}</small>}</span>
        <TeamBadge code={opp} size="md" /><span className="mts-opp"><b>{tName(opp)}</b><small>{home ? 'Hemma' : 'Borta'}</small></span>{right}
      </a>
    )
  }
  return (
    <div className="mday-side mts" style={{ '--tc': tColor(f) } as React.CSSProperties}>
      <a className="mts-hero" href={`#/lag/${f}`}>
        {teams[f]?.logo && <img className="mts-logo" src={teams[f].logo} alt="" />}
        <span className="mts-lbl">★ Mitt lag</span>
        <b className="mts-name" style={{ '--n': tName(f).length } as React.CSSProperties}>{tName(f)}</b>
        <span className="mts-pos"><span className="mts-rank">{core.standings.indexOf(r) + 1}</span>{r.pts} poäng · {r.gp} matcher</span>
      </a>
      <div className="mts-body">
        <div className="mts-row"><span className="mts-k">Form</span><FormChips code={f} /></div>
        <div className="mts-odds">
          <div><b className="num">{oddsTxt(s.top10)}</b><span>Slutspel</span></div>
          <div><b className="num">{oddsTxt(s.top6)}</b><span>Topp 6</span></div>
          <div><b className="num">{oddsTxt(s.gold)}</b><span>SM-guld</span></div>
        </div>
        {last && <><div className="mts-k">Senaste match</div>{line(last)}</>}
        {coming.length > 0 && <><div className="mts-k">Kommande matcher</div><div className="mts-list">{coming.map(line)}</div></>}
        <div className="mts-foot"><button className="linkbtn" onClick={() => setFav(null)}>Sluta följa</button><a className="more-link" href={`#/lag/${f}`}>Lagsidan ›</a></div>
      </div>
    </div>
  )
}

const dayLabel = (d: string) => {
  const diff = Math.round((Date.parse(d) - Date.parse(todayStr())) / 864e5)
  return diff === 0 ? 'Idag' : diff === -1 ? 'Igår' : diff === 1 ? 'I morgon' : null
}
const Sec = ({ title, sub }: { title: ReactNode; sub?: ReactNode }) => <div className="m-sec"><h2>{title}{sub && <> <small>{sub}</small></>}</h2></div>
const MCard = ({ children, foot }: { children: ReactNode; foot?: { href: string; label: string } }) => (
  <section className="panel m-card"><div className="p-body">{children}</div>{foot && <a className="card-foot" href={foot.href}>{foot.label} ›</a>}</section>
)

// Phones: the news, then your team, or the league in general when no team is followed
function PhoneHome() {
  const { core, games, cur, fav } = useData()
  const f = fav && core.sim[fav] ? fav : null
  const isFav = (g: Game) => !!f && (g.home === f || g.away === f)
  const next = f ? games.find((x) => !isFinal(x) && isFav(x)) : undefined
  const last = f ? [...games].reverse().find((x) => isFinal(x) && isFav(x)) : undefined
  const recent = f ? games.filter((x) => isFinal(x) && isFav(x)).slice(-3) : []
  // No team: the day Matcher opens on (today, or the next game day)
  const days = [...new Set(games.map((g) => g.start.slice(0, 10)))].sort(), t = todayStr()
  const gday = days.includes(t) ? t : days.find((d) => d > t) || days[days.length - 1]
  const dayGames = f ? [] : games.filter((g) => g.start.startsWith(gday)).sort((a, b) => a.start.localeCompare(b.start))
  const want = (f ? [next, last, ...recent] : dayGames).filter(Boolean) as Game[]

  const [det, setDet] = useState<Record<string, GameDetails | null> | null>(null)
  const sig = want.map((g) => `${g.id}|${g.hs}|${g.as}|${g.state}`).join(';')
  useEffect(() => {
    let off = false
    detailsFor(want, core.seasons[cur]).then((d) => { if (!off) setDet(d) })
    return () => { off = true }
  }, [sig]) // eslint-disable-line react-hooks/exhaustive-deps
  const TD = useFile(teamsFile)

  if (!det) return <Skeleton />
  return (
    <>
      <section className="panel mnews"><NewsBox /></section>
      {f ? <FavHome f={f} next={next} last={last} recent={recent} det={det} news={TD.state === 'ready' ? TD.data.news[f] || [] : []} />
        : <LeagueHome gday={gday} games={dayGames} det={det} />}
    </>
  )
}

function FavHome({ f, next, last, recent, det, news }: { f: string; next?: Game; last?: Game; recent: Game[]; det: Record<string, GameDetails | null>; news: import('@/lib/types').TeamNews[] }) {
  const { core, cur, tName } = useData()
  const sk = core.seasons[cur].skaters.filter((p) => p.team === f).sort((a, b) => b.pts - a.pts || b.g - a.g)
  return (
    <>
      <MyTeamCard f={f} recent={recent} det={det} />
      {next && <><Sec title={isLive(next) ? 'Pågår nu' : 'Nästa match'} sub={fmtDay(next.start)} /><GameCard g={next} d={det[next.id]} /></>}
      {last && <><Sec title="Senaste match" sub={fmtDay(last.start)} /><GameCard g={last} d={det[last.id]} /></>}
      <Sec title="Poängliga" />
      <MCard foot={{ href: `#/lag/${f}/trupp`, label: 'Hela truppen' }}>
        <LeaderList rows={sk} val={(p) => p.pts} n={5} logos={false} sub={(p) => `${p.g} mål, ${p.a} assist`} />
      </MCard>
      {news.length > 0 && <><Sec title={`Nyheter om ${tName(f)}`} /><div className="tnews-row"><TeamNewsCards code={f} news={news} /></div></>}
    </>
  )
}

// Hem on phones: the team card. Place and points, current form, the coming games,
// who is hot right now (points in the last three games) and the season odds on one line.
function MyTeamCard({ f, recent, det }: { f: string; recent: Game[]; det: Record<string, GameDetails | null> }) {
  const { core, games, tName } = useData()
  const r = core.standings.find((t) => t.code === f)!, s = core.sim[f], rank = core.standings.indexOf(r) + 1
  const coming = games.filter((x) => !isFinal(x) && (x.home === f || x.away === f)).slice(0, 5)
  const form: Record<string, { id: string; name: string; g: number; a: number }> = {}
  for (const x of recent) {
    const d = det[x.id] as (GameDetails & { box?: Record<string, { id?: string; name: string; g: number; a: number }[]> }) | null
    if (!d) continue
    const side = d.home === f ? 'home' : 'away'
    for (const p of d.box?.[side] || []) if (p.id) { const e = (form[p.id] ??= { id: p.id, name: p.name, g: 0, a: 0 }); e.g += p.g; e.a += p.a }
  }
  const hot = Object.values(form).sort((a, b) => (b.g + b.a) - (a.g + a.a) || b.g - a.g)[0]
  return (
    <section className="panel m-card myteam-m" style={{ '--tc': tColor(f) } as React.CSSProperties}>
      <div className="p-body">
        <a className="mt-head" href={`#/lag/${f}`}>
          <TeamBadge code={f} size="xl" />
          <span className="mt-name"><b>{tName(f)}</b><span className="mt-pos"><span className="gc-rank" style={{ '--zone': zoneBad(rank) } as React.CSSProperties}>{rank}</span>{r.pts} poäng · {r.gp} matcher</span></span>
        </a>
        <div className="mt-row"><span className="mt-lbl">Form</span><FormChips code={f} /></div>
        {coming.length > 0 && <>
          <div className="mt-lbl">Kommande matcher</div>
          <div className="mt-games">
            {coming.map((x) => {
              const home = x.home === f, opp = home ? x.away : x.home, p = dateParts(x.start), ph = x.ph ?? 0.5
              return <a key={x.id} className="mt-g" href={`#/match/${x.id}`}><span className="mt-g-d">{DAYS[p.wd]}<br />{p.d}/{p.m}</span><TeamBadge code={opp} size="md" /><span className="mt-g-h">{home ? 'Hemma' : 'Borta'}</span><span className="mt-g-p num">{pctTxt(home ? ph : 1 - ph)}</span></a>
            })}
          </div>
        </>}
        {hot && hot.g + hot.a > 0 && (
          <a className="mt-hot" href={`#/spelare/${encodeURIComponent(hot.id)}`}>
            <Avatar id={hot.id} name={hot.name} team={f} eager />
            <span><small>Formstark</small><b>{hot.name}</b></span>
            <span className="mt-hot-v"><b className="num">{hot.g + hot.a} p</b><small>{hot.g}+{hot.a} senaste {recent.length}</small></span>
          </a>
        )}
        <div className="mt-odds"><span>Slutspel <b>{oddsTxt(s.top10)}</b></span><span>Topp 6 <b>{oddsTxt(s.top6)}</b></span><span>SM-guld <b>{oddsTxt(s.gold)}</b></span></div>
      </div>
      <a className="card-foot" href={`#/lag/${f}`}>Lagsidan ›</a>
    </section>
  )
}

function LeagueHome({ gday, games, det }: { gday: string; games: Game[]; det: Record<string, GameDetails | null> }) {
  const { core, cur } = useData()
  const lead = [...core.seasons[cur].skaters].sort((a, b) => b.pts - a.pts || b.g - a.g)
  return (
    <>
      {games.length > 0 && <>
        <Sec title={dayLabel(gday) === 'Idag' ? 'Matcher idag' : 'Nästa matchdag'} sub={fmtDay(gday)} />
        {games.slice(0, 3).map((g) => <GameCard key={g.id} g={g} d={det[g.id]} />)}
        {games.length > 3 && <a className="list-foot" href={`#/matcher/${gday}`}>Alla {games.length} matcher ›</a>}
      </>}
      <Sec title="Tabell" />
      <MCard foot={{ href: '#/tabell', label: 'Hela tabellen' }}><StandingsTable mode="stats" /></MCard>
      <Sec title="Poängliga" />
      <MCard foot={{ href: '#/statistik', label: 'All statistik' }}>
        <LeaderList rows={lead} val={(p) => p.pts} n={5} avatars={false} sub={(p) => `${p.team} · ${p.g} mål, ${p.a} assist`} />
      </MCard>
    </>
  )
}
