import type { ReactNode } from 'react'
import { Board } from '@/components/site/Layout'
import { Empty, Panel } from '@/components/site/Panel'
import { ClipCard, LineupGrid } from '@/components/site/Pieces'
import { SortableTable, type Col } from '@/components/site/SortableTable'
import { Avatar, PlayerLink, TeamBadge, TeamLink } from '@/components/site/TeamBadge'
import { TeamToggle } from '@/components/site/TeamToggle'
import { useTeamSide } from '@/lib/pageState'
import { useData } from '@/data/context'
import { dec, mmss, POS_SHORT, signed } from '@/lib/format'
import { safeEmbed } from '@/lib/game'
import { keyMoments, OFFENCE, recapFacts, recapText, threeStars, winSeries } from '@/lib/match'
import { shortName, strengthTag } from '@/lib/stats'
import { pairColors, tColor } from '@/lib/teams'
import type { BoxRow, GameDetails, Lineup, LineupPlayer } from '@/lib/types'
import { useChartWidth, useNarrow } from '@/lib/useNarrow'

const PLAY = <svg className="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z" fill="currentColor" /></svg>
const cssVars = (v: Record<string, string>) => v as React.CSSProperties

// The goals, period by period. Every row has the same columns (time, scorer, score, video), and the video
// slot is kept even without a clip, so the scores always line up.
export function GoalList({ d }: { d: GameDetails }) {
  if (!d.goals.length) return <Empty>Inga mål i matchen.</Empty>
  const pName = (p: number) => p === 4 ? 'Övertid' : p >= 5 ? 'Straffar' : `Period ${p}`
  const periods = [...new Set(d.goals.map((x) => x.p))].sort()
  const [hc, ac] = pairColors(d.home, d.away)
  // No videos at all (e.g. during a game): no video column, so the score sits at the edge
  const anyClip = d.goals.some((x) => x.clip && safeEmbed(x.clip.embed))
  return (
    <div className={`glist ${anyClip ? '' : 'novid'}`}>
      {periods.flatMap((p) => [
        <h4 key={`p${p}`} className="gl-per">{pName(p)}</h4>,
        ...d.goals.filter((x) => x.p === p).map((x, i) => {
          const team = d[x.team], st = strengthTag(x), home = x.team === 'home'
          const assists = [x.a1, x.a2].filter(Boolean)
          const clip = x.clip && safeEmbed(x.clip.embed) ? x.clip : null
          return (
            <div key={`${p}-${i}`} className="gl-row" style={cssVars({ '--gc': home ? hc : ac })}>
              <span className="gl-t num">{x.p >= 5 ? 'Straff' : x.t}</span>
              <span className="gl-av"><Avatar id={x.scorer?.id} name={x.scorer?.name || '?'} team={team} /><TeamBadge code={team} /></span>
              <div className="gl-who">
                <span className="gl-name"><PlayerLink id={x.scorer?.id} name={x.scorer?.name || 'Okänd'} />{st && <span className="tag">{st}</span>}</span>
                <small>{assists.length ? <>Assist: {assists.map((a, k) => <span key={k}>{k > 0 && ', '}<PlayerLink id={a!.id} name={a!.name} /></span>)}</> : 'Ingen assist'}</small>
              </div>
              <span className="gl-sc num"><b className={home ? 'on' : ''}>{x.score[0]}</b><i>–</i><b className={home ? '' : 'on'}>{x.score[1]}</b></span>
              {anyClip && (
                <span className="gl-play">
                  {clip
                    ? <button className="playic" data-embed={clip.embed} data-title={`${x.scorer?.name || 'Mål'} ${x.score[0]}–${x.score[1]}`} aria-label="Spela upp målet">{PLAY}</button>
                    : <span className="gl-novid" title="Ingen video">–</span>}
                </span>
              )}
            </div>
          )
        }),
      ])}
    </div>
  )
}

// One stat as a split bar: home's share on the left in its colour, away's on the right
export function CmpRow({ label, h, a, hv, av, lowerBetter = false }: { label: string; h: ReactNode; a: ReactNode; hv: number; av: number; lowerBetter?: boolean }) {
  const tot = hv + av, hp = tot ? (lowerBetter ? av : hv) / tot * 100 : 50
  return (
    <div className="cmp-row"><span className="v">{h}</span>
      <div className="mid"><span className="lbl">{label}</span><div className="cmp-bar"><i style={{ width: `${hp}%` }} /><i style={{ width: `${100 - hp}%` }} /></div></div>
      <span className="v">{a}</span></div>
  )
}
export function Cmp({ home, away, children, className = '' }: { home: string; away: string; children: ReactNode; className?: string }) {
  const [hc, ac] = pairColors(home, away)
  return (
    <div className={`cmp ${className}`} style={cssVars({ '--h-color': hc, '--a-color': ac })}>
      <div className="cmp-row cmp-head"><span className="v"><TeamBadge code={home} size="md" /></span><span /><span className="v"><TeamBadge code={away} size="md" /></span></div>
      {children}
    </div>
  )
}

export function TeamCompare({ d }: { d: GameDetails }) {
  const H = d.team.home || {}, A = d.team.away || {}
  const has = (k: keyof typeof H) => H[k] != null || A[k] != null // live games only have some of the numbers
  const row = (label: string, k: keyof typeof H) => <CmpRow label={label} h={H[k] ?? 0} a={A[k] ?? 0} hv={H[k] || 0} av={A[k] || 0} />
  return (
    <Cmp home={d.home} away={d.away}>
      {row('Skott på mål', 'SOG')}
      <CmpRow label="Powerplay" h={`${H.PPG ?? 0}/${H.NumPP ?? 0}`} a={`${A.PPG ?? 0}/${A.NumPP ?? 0}`} hv={H.PPG || 0} av={A.PPG || 0} />
      {has('FOW') && row('Vunna tekningar', 'FOW')}
      {has('Hits') && row('Tacklingar', 'Hits')}
      {has('BkS') && row('Blockerade skott', 'BkS')}
      {row('Utvisningsminuter', 'PIM')}
      {has('Saves') && row('Räddningar', 'Saves')}
    </Cmp>
  )
}

// Game flow: shots on goal minute by minute (home up, away down) with the goals marked
export function Momentum({ d }: { d: GameDetails }) {
  const { tName } = useData()
  const W = useChartWidth(640)
  const [hc, ac] = pairColors(d.home, d.away)
  const minOf = (x: { p: number; t?: string }) => { const [m, s] = String(x.t || '0:0').split(':').map(Number); return (x.p - 1) * 20 + (m || 0) + (s || 0) / 60 }
  const goals = d.goals.filter((g) => g.p < 5)
  const evs = [...(d.shots || []).map((s) => ({ ...s, w: 1 })), ...goals.map((g) => ({ ...g, w: 1.6 }))].filter((e) => e.p < 5)
  const L = d.live
  const now = L && L.p ? Math.min(65, (Math.min(L.p, 4) - 1) * 20 + (Number(String(L.t || '0').split(':')[0]) || 0)) : null
  const n = Math.max(60, Math.ceil(Math.max(0, ...evs.map(minOf))) + (goals.some((g) => g.p === 4) ? 1 : 0), now ?? 0)
  const raw = { home: new Array(n).fill(0), away: new Array(n).fill(0) }
  for (const e of evs) { const m = Math.min(n - 1, Math.floor(minOf(e))); if (raw[e.team]) raw[e.team][m] += e.w }
  // A soft running average, so the bars show pressure over a few minutes rather than single shots
  const kern = [0.25, 0.6, 1, 0.6, 0.25]
  const smooth = (a: number[]) => a.map((_, i) => { let s = 0, w = 0; kern.forEach((f, k) => { const j = i + k - 2; if (j >= 0 && j < a.length) { s += a[j] * f; w += f } }); return s / w })
  const H = smooth(raw.home), A = smooth(raw.away), mx = Math.max(0.4, ...H, ...A)
  const Ht = 168, mid = Ht / 2, pad = 10, bw = (W - pad * 2) / n, sc = (mid - 20) / mx
  const bars: ReactNode[] = []
  for (let i = 0; i < n; i++) {
    if (now != null && i > now) break
    const x = pad + i * bw + 0.6, w = Math.max(1, bw - 1.2)
    if (H[i] > 0.02) bars.push(<rect key={`h${i}`} x={x} y={mid - H[i] * sc - 1} width={w} height={H[i] * sc} rx="1.5" style={{ fill: hc }} />)
    if (A[i] > 0.02) bars.push(<rect key={`a${i}`} x={x} y={mid + 1} width={w} height={A[i] * sc} rx="1.5" style={{ fill: ac }} />)
  }
  return (
    <>
      <div className="chart">
        <svg viewBox={`0 0 ${W} ${Ht + 18}`} role="img" aria-label="Matchbild: skott på mål minut för minut">
          {[20, 40, 60].filter((p) => p < n).map((p) => <line key={p} x1={pad + p * bw} x2={pad + p * bw} y1="4" y2={Ht - 4} style={{ stroke: 'var(--line)' }} strokeDasharray="3 4" />)}
          <line x1={pad} x2={W - pad} y1={mid} y2={mid} style={{ stroke: 'var(--line)' }} />
          {bars}
          {goals.map((g, i) => (
            <circle key={`g${i}`} cx={pad + minOf(g) * bw} cy={g.team === 'home' ? 10 : Ht - 10} r="6.5" style={{ fill: g.team === 'home' ? hc : ac, stroke: 'var(--text)' }} strokeWidth="1.6">
              <title>{`${g.scorer?.name || 'Mål'} ${g.score[0]}–${g.score[1]} (${g.t})`}</title>
            </circle>
          ))}
          {now != null && <line x1={pad + now * bw} x2={pad + now * bw} y1="2" y2={Ht - 2} style={{ stroke: 'var(--bad)' }} strokeWidth="2" />}
          {['P1', 'P2', 'P3', 'ÖT'].map((lab, k) => k * 20 < n
            ? <text key={lab} x={pad + (k * 20 + Math.min(20, n - k * 20) / 2) * bw} y={Ht + 14} textAnchor="middle" fontSize="11.5" style={{ fill: 'var(--faint)' }}>{lab}</text> : null)}
        </svg>
      </div>
      <div className="legend">
        <span><i style={{ background: hc }} />{tName(d.home)}</span><span><i style={{ background: ac }} />{tName(d.away)}</span>
        <span><i style={{ background: 'var(--text)', borderRadius: '50%' }} />Mål</span>
      </div>
    </>
  )
}

// Win probability through the game, home above the middle line and away below
export function WinChart({ d }: { d: GameDetails }) {
  const { core, tName } = useData()
  const W = useChartWidth(640)
  const { pts, end, now } = winSeries(d, core.model), [hc, ac] = pairColors(d.home, d.away)
  const span = Math.max(3600, end), H = 190, top = 10, bot = 22, pl = 8, pr = 8, ih = H - top - bot
  const X = (t: number) => pl + t / span * (W - pl - pr), Y = (p: number) => top + (1 - p) * ih, mid = Y(0.5)
  const line = pts.map((q, i) => `${i ? 'L' : 'M'}${X(q.t).toFixed(1)},${Y(q.p).toFixed(1)}`).join('')
  const area = `${line}L${X(pts[pts.length - 1].t).toFixed(1)},${mid}L${X(0)},${mid}Z`
  const last = pts[pts.length - 1], pct = (p: number) => `${Math.round(p * 100)} %`
  return (
    <>
      <div className="wp-now">
        <span className="wp-team" style={cssVars({ '--c': hc })}><TeamBadge code={d.home} size="md" /><b className="num">{pct(now)}</b><small>{tName(d.home)}</small></span>
        <span className="wp-team away" style={cssVars({ '--c': ac })}><small>{tName(d.away)}</small><b className="num">{pct(1 - now)}</b><TeamBadge code={d.away} size="md" /></span>
      </div>
      <div className="chart">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Vinstchans under matchen">
          <defs>
            <clipPath id="wp-up"><rect x="0" y="0" width={W} height={mid} /></clipPath>
            <clipPath id="wp-dn"><rect x="0" y={mid} width={W} height={H} /></clipPath>
          </defs>
          {[1200, 2400, 3600].filter((p) => p < span).map((p) => <line key={p} x1={X(p)} x2={X(p)} y1={top} y2={top + ih} style={{ stroke: 'var(--line)' }} strokeDasharray="3 4" />)}
          {[0.25, 0.75].map((p) => <line key={p} x1={pl} x2={W - pr} y1={Y(p)} y2={Y(p)} style={{ stroke: 'color-mix(in srgb, var(--line) 50%, transparent)' }} />)}
          <path d={area} clipPath="url(#wp-up)" style={{ fill: hc, fillOpacity: 0.28 }} />
          <path d={area} clipPath="url(#wp-dn)" style={{ fill: ac, fillOpacity: 0.28 }} />
          <line x1={pl} x2={W - pr} y1={mid} y2={mid} style={{ stroke: 'var(--muted)' }} strokeWidth="1" />
          <path d={line} fill="none" style={{ stroke: 'var(--text)' }} strokeWidth="2.2" strokeLinejoin="round" />
          {pts.filter((x) => x.goal).map((q, i) => (
            <circle key={i} cx={X(q.t)} cy={Y(q.p)} r="5.5" style={{ fill: q.goal!.team === 'home' ? hc : ac, stroke: 'var(--panel)' }} strokeWidth="2">
              <title>{`${q.goal!.scorer?.name || 'Mål'} ${q.goal!.score[0]}–${q.goal!.score[1]}: ${Math.round(q.p * 100)} % för ${tName(d.home)}`}</title>
            </circle>
          ))}
          <circle cx={X(last.t)} cy={Y(last.p)} r="4.5" style={{ fill: 'var(--text)' }} />
          {/* Which side is which: the team codes in the top and bottom corners (home up, away down) */}
          <text x={pl + 6} y={top + 13} fontSize="11.5" fontWeight="700" style={{ fill: hc }}>{d.home}</text>
          <text x={pl + 6} y={top + ih - 6} fontSize="11.5" fontWeight="700" style={{ fill: ac }}>{d.away}</text>
          {['P1', 'P2', 'P3', 'ÖT'].map((lab, k) => k * 1200 < span
            ? <text key={lab} x={X(k * 1200 + Math.min(1200, span - k * 1200) / 2)} y={H - 6} textAnchor="middle" fontSize="11.5" style={{ fill: 'var(--faint)' }}>{lab}</text> : null)}
        </svg>
      </div>
    </>
  )
}

// Match report (finished games): summary text, three stars, xG and key moments
export function Recap({ d }: { d: GameDetails }) {
  const { tName } = useData()
  if (!d.goals.length || d.hs === d.as) return null
  const F = recapFacts(d), text = recapText(d, F, tName), stars = threeStars(F), moments = keyMoments(d, F)
  const [hc, ac] = pairColors(d.home, d.away)
  let xg: ReactNode = null
  if (d.xg) {
    const [xh, xa, hdh, hda, sh, sa] = d.xg, hp = xh + xa ? xh / (xh + xa) * 100 : 50, win = xh >= xa ? d.home : d.away
    xg = (
      <div className="rx" style={cssVars({ '--hc': hc, '--ac': ac })}>
        <div className="rx-head"><h3>Förväntade mål (xG)</h3><span className="rx-win"><TeamBadge code={win} />{tName(win)} vann chanskampen</span></div>
        <div className="rx-bar"><span className="num">{dec(xh, 2)}</span><div className="rx-track"><i style={{ width: `${hp}%` }} /><i style={{ width: `${100 - hp}%` }} /></div><span className="num">{dec(xa, 2)}</span></div>
        <div className="rx-sub"><span><TeamBadge code={d.home} />{d.hs} mål</span><span>Farliga chanser {hdh}–{hda} · Skott på mål {sh}–{sa}</span><span>{d.as} mål<TeamBadge code={d.away} /></span></div>
      </div>
    )
  }
  return (
    <section className="panel wide recap">
      <div className="p-head"><h2>Matchrapport</h2></div>
      <div className="p-body">
        <div className="recap-grid">
          <div className="recap-main">
            <p className="recap-lead">{text[0]}</p>
            {text.length > 1 && <p className="recap-text">{text.slice(1).join(' ')}</p>}
            {xg}
          </div>
          {stars.length > 0 && (
            <div className="rstars">
              <h3>Matchens tre stjärnor</h3>
              <ol>
                {stars.map((r, i) => (
                  <li key={i}>
                    <span className="rs-n">{'★'.repeat(3 - i)}</span><Avatar id={r.id} name={r.name} team={r.team} size="md" />
                    <div className="rs-who">{r.id ? <PlayerLink id={r.id} name={r.name} /> : <b>{r.name}</b>}<small><TeamBadge code={r.team} />{r.line}</small></div>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
        {moments.length > 0 && (
          <div className="rmoments">
            <h3>Nyckelögonblick</h3>
            <ol>
              {moments.map(([x, labels], i) => (
                <li key={i}>
                  <span className="rm-t num">{x.p <= 3 ? `P${x.p}` : x.p === 4 ? 'ÖT' : 'STR'} {x.p >= 5 ? '' : x.t}</span>
                  <span className="rm-dot" style={{ background: tColor(d[x.team]) }} />
                  <div className="rm-what">
                    <span className="rm-tags">{labels.map((t) => <span key={t} className="rm-tag">{t}</span>)}</span>
                    <span>{x.scorer?.id ? <PlayerLink id={x.scorer.id} name={x.scorer.name} /> : x.scorer?.name || 'Mål'} <span className="faint">{d[x.team]}</span></span>
                  </div>
                  <span className="rm-sc num">{x.score[0]}–{x.score[1]}</span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </section>
  )
}

export function MatchVideo({ d }: { d: GameDetails }) {
  const { tName } = useData()
  const clips = d.goals.filter((x) => x.clip)
  if (!clips.length && !d.hl) return <Panel title="Video"><Empty>Inga videor publicerade för den här matchen ännu. De brukar komma någon timme efter slutsignalen.</Empty></Panel>
  return (
    <Board>
      {d.hl && <Panel title="Sammandrag" className="wide"><ClipCard c={d.hl} title={`${tName(d.home)} ${d.hs}–${d.as} ${tName(d.away)}`} sub="Matchens höjdpunkter" big /></Panel>}
      {clips.length > 0 && (
        <Panel title="Alla mål" className="wide">
          <div className="clips">
            {clips.map((x, i) => (
              <ClipCard key={i} c={x.clip} title={`${x.scorer?.name || 'Mål'} ${x.score[0]}–${x.score[1]}`}
                sub={`${d[x.team]} · ${x.p <= 3 ? 'period ' + x.p : x.p === 4 ? 'övertid' : 'straffar'} ${x.t}${strengthTag(x) ? ' · ' + strengthTag(x) : ''}`} />
            ))}
          </div>
        </Panel>
      )}
    </Board>
  )
}

type BoxR = BoxRow & { pts: number; fo: number | null }
function BoxTable({ d, side }: { d: GameDetails; side: 'home' | 'away' }) {
  const narrow = useNarrow()
  const team = d[side]
  const rows: BoxR[] = (d.box[side] || []).map((r) => ({ ...r, pts: r.g + r.a, fo: r.fow + r.fol ? r.fow / (r.fow + r.fol) : null }))
  const cols: Col<BoxR>[] = [
    { k: 'name', label: 'Spelare', l: true, asc: true, h: (r) => <div className="pcell"><Avatar id={r.id} name={r.name} team={team} /><div><PlayerLink id={r.id} name={r.name} /><br /><small>#{r.num ?? '–'} · {POS_SHORT[r.pos] || ''}</small></div></div> },
    { k: 'g', label: 'M', title: 'Mål' }, { k: 'a', label: 'A', title: 'Assist' }, { k: 'pts', label: 'P', title: 'Poäng' },
    { k: 'pm', label: '+/-', f: signed }, { k: 'sog', label: 'Skott' }, { k: 'pim', label: 'Utv', title: 'Utvisningsminuter' },
    { k: 'toi', label: 'Istid', f: mmss }, { k: 'hits', label: 'Tackl.' }, { k: 'blk', label: 'Block' },
    { k: 'fo', label: 'Tekn%', f: (v: number) => dec(v * 100, 0) },
  ]
  const use = narrow
    ? [{ k: 'name', label: 'Spelare', l: true, asc: true, h: (r: BoxR) => <div className="pcell rankcell"><Avatar id={r.id} name={r.name} team={team} /><div className="rk-nm"><PlayerLink id={r.id} name={shortName(r.name)} /><small>#{r.num ?? '–'} · {POS_SHORT[r.pos] || ''}</small></div></div> } as Col<BoxR>,
      ...cols.filter((c) => ['g', 'a', 'pts', 'pm', 'sog'].includes(c.k))]
    : cols
  return <SortableTable cols={use} rows={rows.map((r) => ({ ...r, team: undefined }))} sortKey={narrow ? 'pts' : 'toi'} />
}

// Uppställning for a played or live game: the lines each team used (from the game's player list)
const ORDER: Record<string, number> = { LW: 0, C: 1, CE: 1, RW: 2, LD: 0, RD: 1 }
function linesOf(d: GameDetails, side: 'home' | 'away'): Lineup | null {
  const box = d.box?.[side] || []
  if (!box.length) return null
  const F: Record<string, LineupPlayer[]> = {}, D: Record<string, LineupPlayer[]> = {}
  for (const p of box) ((/D$/.test(p.pos) ? (D[p.line ?? ''] ??= []) : (F[p.line ?? ''] ??= []))).push(p)
  for (const grp of [F, D]) for (const k in grp) grp[k].sort((a, b) => (ORDER[a.pos || ''] ?? 1) - (ORDER[b.pos || ''] ?? 1))
  const G = [...(d.gk?.[side] || [])].sort((a, b) => (b.soga || 0) - (a.soga || 0) || (a.line ?? 9) - (b.line ?? 9)).map((x) => ({ ...x, pos: 'GK' }))
  return { F, D, G }
}

export function MatchPlayers({ d, official }: { d: GameDetails; official?: { home: Lineup; away: Lineup } | null }) {
  const narrow = useNarrow()
  const [side, setSide] = useTeamSide()
  const gkRows = (['home', 'away'] as const).flatMap((s) => (d.gk[s] || []).filter((r) => r.soga > 0).map((r) => ({ ...r, team: d[s] })))
  return (
    <Board>
      <Panel title="Målvakter" className="wide">
        <div className="tscroll">
          <table className="t" id="gk-table">
            <thead><tr><th className="l">Målvakt</th><th>Skott</th><th>Räddn.</th><th>Insl.</th><th>Rädd%</th></tr></thead>
            <tbody>
              {gkRows.map((r, i) => (
                <tr key={i}>
                  <td className="l"><div className="pcell"><TeamBadge code={r.team} />{!narrow && <Avatar id={r.id} name={r.name} team={r.team} />}<PlayerLink id={r.id} name={narrow ? shortName(r.name) : r.name} /></div></td>
                  <td>{r.soga}</td><td>{r.svs}</td><td>{r.ga}</td><td className="hl">{dec(r.svs / r.soga * 100, 1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      <Panel title="Spelare" className="wide">
        <TeamToggle home={d.home} away={d.away} side={side} setSide={setSide} panes={{ home: <BoxTable d={d} side="home" />, away: <BoxTable d={d} side="away" /> }} />
      </Panel>
      {/* Phones: the line-ups under the players' stats */}
      {narrow && (
        <Panel title="Uppställning" className="wide">
          <TeamToggle home={d.home} away={d.away} side={side} setSide={setSide}
            panes={{ home: <LineupGrid L={linesOf(d, 'home') || official?.home} code={d.home} />, away: <LineupGrid L={linesOf(d, 'away') || official?.away} code={d.away} /> }} />
        </Panel>
      )}
    </Board>
  )
}

export function MatchEvents({ d }: { d: GameDetails }) {
  const { tName } = useData()
  const narrow = useNarrow()
  const cell = (g: number, sh?: number) => <><b className="num">{g}</b><small className="num">{sh ?? '–'} skott</small></>
  return (
    <Board>
      <Panel title="Skottkarta" className="wide" sub={`${tName(d.home)} anfaller åt höger, ${tName(d.away)} åt vänster. Ungefärliga positioner.`}>
        <div className="chart"><Rink d={d} /></div>
      </Panel>
      <Panel title="Utvisningar">
        {d.pens.length ? (
          <div className="timeline">
            {d.pens.map((x, i) => (
              <div className="ev" key={i}>
                <span className="t">P{x.p} {x.t}</span><TeamBadge code={d[x.team]} />
                <div className="who">{x.player ? <PlayerLink id={x.player.id} name={x.player.name} /> : 'Bench minor'}<small>{OFFENCE[x.off || ''] || x.off}</small></div>
                <span className="muted">{x.desc.replace('Team Penalty', 'Bench minor')}</span>
              </div>
            ))}
          </div>
        ) : <Empty>Inga utvisningar.</Empty>}
      </Panel>
      {/* Goals and shots on goal per period in one table: goals large, shots under them */}
      <Panel title="Mål och skott per period">
        {d.periods.length ? (
          <div className="tscroll">
            <table className="t pertab">
              <thead><tr><th className="l">Lag</th>{d.periods.map((p) => <th key={p.p}>{p.p <= 3 ? `P${p.p}` : p.p === 4 ? 'ÖT' : 'STR'}</th>)}<th>Totalt</th></tr></thead>
              <tbody>
                {(['home', 'away'] as const).map((s) => (
                  <tr key={s}>
                    <td className="l"><TeamLink code={d[s]} name={!narrow} /></td>
                    {d.periods.map((p) => p.p >= 5
                      ? <td key={p.p}><b className="num">{s === 'home' ? p.h : p.a}</b><small>straffar</small></td>
                      : <td key={p.p}>{cell(s === 'home' ? p.h : p.a, s === 'home' ? p.hs : p.as)}</td>)}
                    <td className="hl">{cell((s === 'home' ? d.hs : d.as) ?? 0, d.team[s].SOG)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <Empty>Ingen periodstatistik.</Empty>}
      </Panel>
    </Board>
  )
}

// Shot map: a 60 × 30 m rink in 0.1 m units; x in the data is the distance from the attacked goal line
function Rink({ d }: { d: GameDetails }) {
  const { tName } = useData()
  const W = 600, H = 300, GL = 40
  const [hc, ac] = pairColors(d.home, d.away), col = (s: string) => s === 'home' ? hc : ac
  const pt = (s: string, e: { x?: number; y?: number }) => s === 'home' ? [W - GL - e.x!, H / 2 - e.y!] : [GL + e.x!, H / 2 + e.y!]
  return (
    <>
      <svg viewBox={`-4 -4 ${W + 8} ${H + 26}`} role="img" aria-label="Skottkarta">
        <rect x="0" y="0" width={W} height={H} rx="84" style={{ fill: 'var(--panel-2)', stroke: 'var(--line)' }} strokeWidth="2" />
        <line x1={W / 2} x2={W / 2} y1="0" y2={H} style={{ stroke: 'color-mix(in srgb, var(--bad) 55%, transparent)' }} strokeWidth="4" />
        <line x1={W / 2 - 71} x2={W / 2 - 71} y1="0" y2={H} style={{ stroke: 'color-mix(in srgb, var(--accent) 60%, transparent)' }} strokeWidth="4" />
        <line x1={W / 2 + 71} x2={W / 2 + 71} y1="0" y2={H} style={{ stroke: 'color-mix(in srgb, var(--accent) 60%, transparent)' }} strokeWidth="4" />
        <circle cx={W / 2} cy={H / 2} r="45" style={{ fill: 'none', stroke: 'var(--line)' }} strokeWidth="2" />
        <line x1={GL} x2={GL} y1="12" y2={H - 12} style={{ stroke: 'color-mix(in srgb, var(--bad) 45%, transparent)' }} strokeWidth="2" />
        <line x1={W - GL} x2={W - GL} y1="12" y2={H - 12} style={{ stroke: 'color-mix(in srgb, var(--bad) 45%, transparent)' }} strokeWidth="2" />
        {[[GL + 60, 80], [GL + 60, 220], [W - GL - 60, 80], [W - GL - 60, 220]].map(([cx, cy], i) => <circle key={i} cx={cx} cy={cy} r="45" style={{ fill: 'none', stroke: 'var(--line)' }} strokeWidth="2" />)}
        <path d={`M${GL} 132 a18 18 0 0 1 0 36`} style={{ fill: 'color-mix(in srgb, var(--accent) 25%, transparent)' }} />
        <path d={`M${W - GL} 132 a18 18 0 0 0 0 36`} style={{ fill: 'color-mix(in srgb, var(--accent) 25%, transparent)' }} />
        {d.shots.filter((s) => s.x != null).map((s, i) => { const [x, y] = pt(s.team, s); return <circle key={`s${i}`} cx={x} cy={y} r="5" style={{ fill: col(s.team), opacity: 0.6, stroke: 'var(--panel)' }} strokeWidth="1" /> })}
        {d.goals.filter((g) => g.x != null).map((g, i) => {
          const [x, y] = pt(g.team, g)
          return <g key={`g${i}`} transform={`translate(${x} ${y})`}><circle r="9" style={{ fill: col(g.team), stroke: 'var(--text)' }} strokeWidth="2" /><title>{`Mål: ${g.scorer?.name || ''} (${g.t})`}</title></g>
        })}
        <text x="10" y={H + 18} fontSize="12" style={{ fill: 'var(--muted)' }}>◀ {d.away} anfaller</text>
        <text x={W - 10} y={H + 18} textAnchor="end" fontSize="12" style={{ fill: 'var(--muted)' }}>{d.home} anfaller ▶</text>
      </svg>
      <div className="legend" style={{ marginTop: 8 }}>
        <span><i style={{ background: hc, borderRadius: '50%' }} />{tName(d.home)}</span><span><i style={{ background: ac, borderRadius: '50%' }} />{tName(d.away)}</span><span>Stor ring = mål</span>
      </div>
    </>
  )
}
