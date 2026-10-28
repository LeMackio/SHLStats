import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { HBars } from '@/components/charts/Basic'
import { GameCard, GameRow } from '@/components/site/Games'
import { Seg } from '@/components/site/Layout'
import { Empty, MoreLink, Panel, Skeleton } from '@/components/site/Panel'
import { ClipCard, LeaderList, NewsBox, TeamNewsCards } from '@/components/site/Pieces'
import { Legend, StandingsTable } from '@/components/site/Standings'
import { Avatar, TeamBadge } from '@/components/site/TeamBadge'
import { TeamNow } from '@/components/site/TeamNow'
import { useData } from '@/data/context'
import { detailsFor } from '@/data/games'
import { teamsFile, useFile } from '@/data/loaders'
import { dec, fmtDay, sum, todayStr } from '@/lib/format'
import { liveTable } from '@/lib/liveTable'
import { goalieMinGp, gsaa } from '@/lib/stats'
import { lum, tColor } from '@/lib/teams'
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

  const anyLive = games.some(isLive)
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
        {/* The table right now: games being played count at their current score and the rows move as goals go in */}
        <Panel title="Tabell" extra={anyLive ? <span className="live-badge"><i className="live-dot" />Live</span> : undefined}
          foot={<><MoreLink href="#/tabell">Hela tabellen</MoreLink><span className="stamp">{anyLive ? 'Pågående matcher räknas med ställningen just nu' : `Uppdaterad ${stamp}`}</span></>}>
          <div id="ov-table"><StandingsTable mode="stats" live /></div>
          <Legend />
        </Panel>
        <Panel title="Spelare" extra={<Seg id="ov-sk-stat" value={skStat} onChange={setSkStat} options={[['pts', 'Poäng'], ['g', 'Mål'], ['a', 'Assist']]} />}
          foot={<MoreLink href="#/statistik">All statistik</MoreLink>}>
          <div id="ov-sk" className="fill">
            <LeaderList rows={[...season.skaters].sort((a, b) => skOrder(b) - skOrder(a))} val={skVal} avatars={false} sub={(p) => `${p.g}+${p.a} på ${p.gp} matcher`} />
          </div>
        </Panel>
        <Panel title="Målvakter" extra={<Seg id="ov-gk-stat" value={gkStat} onChange={setGkStat} options={[['svp', 'Rädd%'], ['gaa', 'GAA'], ['gsaa', 'GSAA']]} />}
          foot={<MoreLink href="#/statistik">Alla målvakter</MoreLink>}>
          <div id="ov-gk" className="fill">
            <LeaderList rows={season.goalies.filter((g) => g.gpi >= gmin).sort((a, b) => gkOrder(b) - gkOrder(a))} val={(g) => g} fmt={gkFmt} avatars={false} sub={(g) => `${g.gpi} matcher`} />
          </div>
        </Panel>
      </div>
      <div className="ov-row r-two">
        <Panel title="Senaste resultat" more={{ href: '#/matcher/spelade', label: 'Alla resultat' }}>
          {lastGames.length ? <div className="day"><h3>{fmtDay(lastDate)}</h3>{lastGames.map((g) => <GameRow key={g.id} g={g} />)}</div> : <Empty>Inga spelade matcher ännu.</Empty>}
        </Panel>
        <Panel title="Kommande matcher" more={{ href: '#/matcher', label: 'Alla matcher' }}>
          {comingDays.length ? comingDays.map(([d, gs]) => (
            <div className="day" key={d}><h3>{d === today ? 'Idag' : fmtDay(d)}</h3>{gs.map((g) => <GameRow key={g.id} g={g} />)}</div>
          )) : <Empty>Inga fler matcher i grundserien.</Empty>}
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
        <Panel title="Slutspelsstrecket">
          <div className="chart"><HBars items={race} max={1} labelW={140} logos color={(it) => (it.v >= 0.5 ? 'var(--accent)' : 'var(--bad)')} /></div>
        </Panel>
        <Panel title="Chans till SM-guld" more={{ href: '#/tabell', label: 'Alla odds' }}>
          <div className="chart"><HBars items={gold} labelW={140} logos /></div>
        </Panel>
      </div>
    </>
  )
}

// Your team next to the news (computers), built like the team page hero: club-colour header with the logo large,
// then form, the season odds, the last result and the next three games with the win chance. Or a team picker.
function MyTeamSide() {
  const { core, codes, tName, fav, setFav } = useData()
  const f = fav && core.sim[fav] ? fav : null
  if (!f) {
    return (
      <div className="mday-side">
        <span className="mini-lbl">Följ ditt lag</span>
        <div className="pickteams sm">
          {[...codes].sort((a, b) => tName(a).localeCompare(tName(b), 'sv')).map((c) => (
            <button key={c} title={`Följ ${tName(c)}`} aria-label={`Följ ${tName(c)}`} onClick={() => setFav(c)}><TeamBadge code={c} size="md" /></button>
          ))}
        </div>
      </div>
    )
  }
  return <TeamNow f={f} />
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
      {f ? <FavHome f={f} next={next} last={last} det={det} news={TD.state === 'ready' ? TD.data.news[f] || [] : []} />
        : <LeagueHome gday={gday} games={dayGames} det={det} />}
    </>
  )
}

function FavHome({ f, next, last, det, news }: { f: string; next?: Game; last?: Game; det: Record<string, GameDetails | null>; news: import('@/lib/types').TeamNews[] }) {
  const { tName } = useData()
  return (
    <>
      <FavTeamCard f={f} next={next} last={last} det={det} />
      {news.length > 0 && <><Sec title={`Nyheter om ${tName(f)}`} /><div className="tnews-row"><TeamNewsCards code={f} news={news} /></div></>}
    </>
  )
}

// The followed team on phones: one card. On top the club-colour bar: logo, name, table place, points and the form (the
// last five results as squares, oldest first, each opening its game); the rest of the bar opens the team page. Then,
// in the match card's style, the next (or live) game and the latest result as match cards without their own surface,
// and the team's top five in points as rows built like a match card's team rows.
function FavTeamCard({ f, next, last, det }: { f: string; next?: Game; last?: Game; det: Record<string, GameDetails | null> }) {
  const { core, cur, games, tName, teams } = useData()
  const table = useMemo(() => liveTable(core, games), [core, games])
  const me = table.find((r) => r.code === f)
  const form = games.filter((g) => isFinal(g) && (g.home === f || g.away === f)).slice(-5).map((g) => {
    const home = g.home === f, us = (home ? g.hs : g.as) ?? 0, them = (home ? g.as : g.hs) ?? 0
    return { g, us, them, won: us > them }
  })
  const top = core.seasons[cur].skaters.filter((p) => p.team === f).sort((a, b) => b.pts - a.pts || b.g - a.g).slice(0, 5)
  const tc = tColor(f)
  return (
    <section className="panel m-card mts team-card" style={{ '--tc': tc, '--tt': lum(tc) > 0.5 ? '#10151c' : '#ffffff' } as React.CSSProperties}>
      <div className="mts-hero">
        {teams[f]?.logo && <img className="mts-logo" src={teams[f].logo} alt="" />}
        {/* The name's link covers the whole bar; the form squares sit above it as their own links */}
        <a className="mts-name tc-cover" href={`#/lag/${f}`} style={{ '--n': tName(f).length } as React.CSSProperties}>{tName(f)}</a>
        {me && <span className="mts-pos"><span className="mts-rank">{me.rank}</span>{me.pts} poäng</span>}
        {form.length > 0 && (
          <div className="tc-sqs">
            {form.map((x) => (
              <a key={x.g.id} href={`#/match/${x.g.id}`} className={`tc-sq ${x.won ? 'w' : 'l'}`} title={`${x.us}–${x.them}${x.g.ot || x.g.so ? ' efter övertid' : ''}`}>{x.won ? 'V' : 'F'}</a>
            ))}
          </div>
        )}
      </div>
      <div className="tc-body">
        {next && <GameCard g={next} d={det[next.id]} bare />}
        {last && <GameCard g={last} d={det[last.id]} bare />}
        {top.length > 0 && (
          <ol className="tc-top">
            {top.map((p) => (
              <li key={p.id}>
                <a className="tc-p" href={`#/spelare/${encodeURIComponent(p.id)}`}>
                  <Avatar id={p.id} name={p.name} team={f} eager />
                  <span className="tc-who"><span className="tc-nm"><b>{p.name}</b></span><small>{p.g} mål · {p.a} assist</small></span>
                  <span className="tc-pts num">{p.pts}</span>
                </a>
              </li>
            ))}
          </ol>
        )}
      </div>
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
      <MCard foot={{ href: '#/tabell', label: 'Hela tabellen' }}><StandingsTable mode="stats" live /></MCard>
      <Sec title="Poängliga" />
      <MCard foot={{ href: '#/statistik', label: 'All statistik' }}>
        <LeaderList rows={lead} val={(p) => p.pts} n={5} avatars={false} sub={(p) => `${p.team} · ${p.g} mål, ${p.a} assist`} />
      </MCard>
    </>
  )
}
