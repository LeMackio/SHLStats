import { Seg } from '@/components/site/Layout'
import { Empty, Panel, Skeleton } from '@/components/site/Panel'
import { ClipCard } from '@/components/site/Pieces'
import { TeamBadge } from '@/components/site/TeamBadge'
import { useData } from '@/data/context'
import { mediaFile, useFile } from '@/data/loaders'
import { dec, fmtDay, todayStr } from '@/lib/format'
import { go } from '@/lib/router'
import type { GoalClip, MediaData } from '@/lib/types'

// Media (phones' menu): only video. The best goals, the goals from the hardest chances, highlights packages and every goal
export function MediaPage({ range }: { range: string }) {
  const M = useFile(mediaFile)
  if (M.state === 'loading') return <Skeleton />
  if (M.state === 'error') return <Panel title="Media"><Empty>Videorna kunde inte laddas. Försök igen om en stund.</Empty></Panel>
  return <Media M={M.data} want={range} />
}

function Media({ M, want }: { M: MediaData; want: string }) {
  const { fav, tName } = useData()
  const range = want === 'dag' ? 'dag' : want === 'lag' && fav ? 'lag' : 'vecka'
  const latest = [...(M.clips || []).map((c) => c.date), ...(M.highlights || []).map((h) => h.date)].sort().pop() || todayStr()
  const lastDay = latest.slice(0, 10), since = new Date(Date.parse(lastDay) - 6 * 864e5).toISOString().slice(0, 10)
  const keep = range === 'dag' ? (d: string) => d.startsWith(lastDay) : range === 'vecka' ? (d: string) => d.slice(0, 10) >= since : () => true
  const mine = (a: string, b: string) => range !== 'lag' || a === fav || b === fav
  const clips = (M.clips || []).filter((c) => keep(c.date) && mine(c.team, c.opp))
  const hls = (M.highlights || []).filter((h) => keep(h.date) && mine(h.home, h.away)).slice(0, 12)

  // Dream goals: the lowest chance of scoring (xG). Best goals: big moments first (winners, overtime, shorthanded), then difficulty.
  const real = clips.filter((c) => c.xg != null && !c.en) as (GoalClip & { xg: number })[]
  const dream = [...real].sort((a, b) => a.xg - b.xg).slice(0, 5), dreamIds = new Set(dream.map((c) => c.id))
  // Difficulty is the goal's place among all goals by xG (0–1); the biggest moment (winner, overtime or shorthanded) adds a little.
  // At most two goals per game, one per player and two overtime goals, so the list stays varied.
  const byXg = [...real].sort((a, b) => b.xg - a.xg), diff = new Map(byXg.map((c, k) => [c.id, byXg.length > 1 ? k / (byXg.length - 1) : 1]))
  const weight = (c: GoalClip) => diff.get(c.id)! * 2 + Math.max(c.gwg ? 0.35 : 0, c.p === 4 ? 0.35 : 0, /^(SH|BP)/.test(c.str || '') ? 0.35 : 0)
  const best: GoalClip[] = [], perGame: Record<string, number> = {}, players = new Set<string>()
  for (const c of real.filter((x) => !dreamIds.has(x.id)).sort((a, b) => weight(b) - weight(a))) {
    const who = c.scorer?.id || c.scorer?.name
    if ((perGame[c.gid] || 0) >= 2 || (who && players.has(who)) || (c.p === 4 && best.filter((x) => x.p === 4).length >= 2)) continue
    best.push(c); perGame[c.gid] = (perGame[c.gid] || 0) + 1; if (who) players.add(who)
    if (best.length === 10) break
  }
  const who = (c: GoalClip) => c.scorer?.name || 'Mål'
  const tag = (c: GoalClip) => [c.p === 4 ? 'Avgjorde i ÖT' : c.gwg ? 'Matchvinnare' : '', /^(SH|BP)/.test(c.str || '') ? 'Boxplay' : ''].filter(Boolean).join(' · ')
  const bestTitle = range === 'dag' ? 'Dagens bästa mål' : range === 'lag' ? `${tName(fav!)}s bästa mål` : 'Veckans bästa mål'

  return (
    <>
      <Seg className="media-tabs" id="media-range" fill label="Visa" value={range} onChange={(r) => go(r === 'vecka' ? '#/media' : `#/media/${r}`)}
        options={[['dag', 'Matchdagen'], ['vecka', 'Veckan'], ...(fav ? [['lag', <><TeamBadge code={fav} />{fav}</>] as ['lag', React.ReactNode]] : [])]} />
      {best.length > 0 && <>
        <div className="m-sec"><h2>{bestTitle}</h2><p>Svåra lägen och stora ögonblick, högst två mål per match.</p></div>
        <div className="clips mclips hrow ranked">{best.map((c) => <ClipCard key={c.id} c={c} title={who(c)} sub={[`${c.team} mot ${c.opp}`, tag(c)].filter(Boolean).join(' · ')} />)}</div>
      </>}
      {dream.length > 0 && <>
        <div className="m-sec"><h2>Drömmål</h2><p>Målen från de svåraste lägena, enligt xG.</p></div>
        <div className="clips mclips hrow">{dream.map((c) => <ClipCard key={c.id} c={c} title={who(c)} sub={`${c.team} mot ${c.opp} · ${dec(c.xg * 100, c.xg < 0.1 ? 1 : 0)} % chans`} />)}</div>
      </>}
      {hls.length > 0 && <>
        <div className="m-sec"><h2>Matchsammandrag</h2></div>
        <div className="clips mclips hrow">{hls.map((h) => <ClipCard key={h.gid} c={h} title={`${h.home} ${h.hs}–${h.as} ${h.away}`} sub={fmtDay(h.date)} />)}</div>
      </>}
      <div className="m-sec"><h2>Alla mål <small>{clips.length}</small></h2></div>
      {clips.length
        ? <div className="clips mclips grid2">{clips.map((c) => <ClipCard key={c.id} c={c} title={who(c)} sub={`${c.team} mot ${c.opp} · ${c.score[0]}–${c.score[1]}`} />)}</div>
        : <Empty>Inga målvideor här ännu. De brukar komma någon timme efter slutsignalen.</Empty>}
    </>
  )
}
