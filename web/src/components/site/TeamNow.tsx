import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useData } from '@/data/context'
import { detailsFor } from '@/data/games'
import { liveClock, loadLive, type LiveData } from '@/data/live'
import { dateParts, fmtDay, fmtTime, oddsTxt, pctTxt, todayStr } from '@/lib/format'
import { liveTable, type LiveStanding } from '@/lib/liveTable'
import { tColor } from '@/lib/teams'
import { isFinal, isLive, type Game, type GameDetails } from '@/lib/types'
import { FormChips } from './Pieces'
import { Avatar, TeamBadge } from './TeamBadge'
import styles from './TeamNow.module.css'

const ordinal = (n: number) => `${n}:${n === 1 || n === 2 ? 'a' : 'e'}`
const whenTxt = (g: Game) => {
  const d = g.start.slice(0, 10), diff = Math.round((Date.parse(d) - Date.parse(todayStr())) / 864e5)
  const day = diff === 0 ? 'Idag' : diff === 1 ? 'I morgon' : fmtDay(d)
  return `${day[0].toUpperCase()}${day.slice(1)} ${fmtTime(g.start)}`
}

// The followed team's card at the top of Hem: what matters right now. The game being played (live score), or else the
// next game with the win chance; the latest result; how far the team is from the lines that decide the season (top 6
// and the playoff line), counted on the live table; and who is in form.
export function TeamNow({ f, onUnfollow }: { f: string; onUnfollow: () => void }) {
  const { core, games, cur, tName, teams } = useData()
  const table = useMemo(() => liveTable(core, games), [core, games])
  const me = table.find((r) => r.code === f)!
  const mine = (g: Game) => g.home === f || g.away === f
  const live = games.find((g) => isLive(g) && mine(g))
  const next = games.find((g) => !isFinal(g) && !isLive(g) && mine(g))
  const recent = games.filter((g) => isFinal(g) && mine(g)).slice(-3)
  const last = recent[recent.length - 1]
  const s = core.sim[f]

  // The live clock, and the goals of the last three games for the in-form player
  const [L, setL] = useState<LiveData | null>(null)
  useEffect(() => {
    if (!live) return
    let off = false
    loadLive(live.id).then((x) => { if (!off) setL(x) })
    return () => { off = true }
  }, [live?.id, live?.hs, live?.as]) // eslint-disable-line react-hooks/exhaustive-deps
  const [det, setDet] = useState<Record<string, GameDetails | null>>({})
  const sig = recent.map((g) => g.id).join()
  useEffect(() => {
    let off = false
    detailsFor(recent, core.seasons[cur]).then((d) => { if (!off) setDet(d) })
    return () => { off = true }
  }, [sig]) // eslint-disable-line react-hooks/exhaustive-deps
  const hot = useMemo(() => {
    const pts: Record<string, { id: string; name: string; g: number; a: number }> = {}
    for (const g of recent) {
      const d = det[g.id] as (GameDetails & { box?: Record<string, { id?: string; name: string; g: number; a: number }[]> }) | null
      if (!d) continue
      for (const p of d.box?.[d.home === f ? 'home' : 'away'] || []) if (p.id) { const e = (pts[p.id] ??= { id: p.id, name: p.name, g: 0, a: 0 }); e.g += p.g; e.a += p.a }
    }
    return Object.values(pts).sort((a, b) => b.g + b.a - (a.g + a.a) || b.g - a.g)[0]
  }, [det, sig, f]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className={`mday-side mts ${styles.card}`} style={{ '--tc': tColor(f) } as React.CSSProperties}>
      <a className="mts-hero" href={`#/lag/${f}`}>
        {teams[f]?.logo && <img className="mts-logo" src={teams[f].logo} alt="" />}
        <span className="mts-lbl">★ Mitt lag</span>
        <b className="mts-name" style={{ '--n': tName(f).length } as React.CSSProperties}>{tName(f)}</b>
        <span className="mts-pos"><span className="mts-rank">{me.rank}</span>{me.pts} poäng · {me.gp} matcher{me.live ? ' · live' : ''}</span>
      </a>
      <div className={styles.body}>
        {live ? <LiveGame g={live} f={f} L={L} table={table} /> : next ? <NextGame g={next} f={f} table={table} /> : null}
        {last && <LastGame g={last} f={f} />}
        <Situation me={me} table={table} top6={s?.top6} top10={s?.top10} />
        {hot && hot.g + hot.a > 0 && (
          <a className={styles.hot} href={`#/spelare/${encodeURIComponent(hot.id)}`}>
            <Avatar id={hot.id} name={hot.name} team={f} eager />
            <span className={styles.hotName}><small>I form</small><b>{hot.name}</b></span>
            <span className={styles.hotVal}><b className="num">{hot.g + hot.a} p</b><small>{hot.g}+{hot.a} senaste {recent.length} matcherna</small></span>
          </a>
        )}
        <div className={styles.foot}><button className="linkbtn" onClick={onUnfollow}>Sluta följa</button><a className="more-link" href={`#/lag/${f}`}>Lagsidan ›</a></div>
      </div>
    </div>
  )
}

const Block = ({ label, children, href }: { label: ReactNode; children: ReactNode; href?: string }) => {
  const inner = <><span className={styles.label}>{label}</span>{children}</>
  return href ? <a className={styles.block} href={href}>{inner}</a> : <div className={styles.block}>{inner}</div>
}

function LiveGame({ g, f, L, table }: { g: Game; f: string; L: LiveData | null; table: LiveStanding[] }) {
  const { tName } = useData()
  const home = g.home === f, opp = home ? g.away : g.home, us = (home ? g.hs : g.as) ?? 0, them = (home ? g.as : g.hs) ?? 0
  const oppRow = table.find((r) => r.code === opp)
  return (
    <Block label={<><i className="live-dot" />Pågår nu · {liveClock(L)}</>} href={`#/match/${g.id}`}>
      <div className={styles.liveScore}>
        <span className={styles.side}><TeamBadge code={f} size="md" /><b>{f}</b></span>
        <b className={`${styles.score} num`}>{us}–{them}</b>
        <span className={`${styles.side} ${styles.right}`}><b>{opp}</b><TeamBadge code={opp} size="md" /></span>
      </div>
      <span className={styles.sub}>{us > them ? 'Leder' : us < them ? 'Ligger under' : 'Lika'} mot {tName(opp)}{oppRow ? ` (${ordinal(oppRow.rank)})` : ''} · Följ matchen ›</span>
    </Block>
  )
}

function NextGame({ g, f, table }: { g: Game; f: string; table: LiveStanding[] }) {
  const { tName } = useData()
  const home = g.home === f, opp = home ? g.away : g.home, ph = g.ph ?? 0.5, win = home ? ph : 1 - ph
  const oppRow = table.find((r) => r.code === opp)
  return (
    <Block label={`Nästa match · ${whenTxt(g)}`} href={`#/match/${g.id}`}>
      <div className={styles.next}>
        <TeamBadge code={opp} size="lg" />
        <span className={styles.opp}><b>{tName(opp)}</b><small>{home ? 'Hemma' : 'Borta'}{oppRow ? ` · ${ordinal(oppRow.rank)} i tabellen` : ''}</small></span>
        <span className={styles.win}><b className="num">{pctTxt(win)}</b><small>vinstchans</small></span>
      </div>
      <div className={styles.bar} aria-hidden="true"><i style={{ width: `${win * 100}%` }} /></div>
      <div className={styles.oppForm}><small>{opp}s form</small><FormChips code={opp} /></div>
    </Block>
  )
}

function LastGame({ g, f }: { g: Game; f: string }) {
  const { tName } = useData()
  const home = g.home === f, opp = home ? g.away : g.home, us = (home ? g.hs : g.as)!, them = (home ? g.as : g.hs)!, won = us > them
  const p = dateParts(g.start)
  return (
    <a className={styles.last} href={`#/match/${g.id}`}>
      <span className={styles.label}>Senaste</span>
      <span className={`${styles.res} ${won ? styles.w : styles.l}`}>{won ? 'V' : 'F'}</span>
      <span className="num"><b>{us}–{them}</b>{g.ot || g.so ? <small> {g.so ? 'str' : 'ÖT'}</small> : null}</span>
      <span className={styles.lastOpp}>{home ? 'mot' : 'borta mot'} {tName(opp)}</span>
      <small className={styles.date}>{p.d}/{p.m}</small>
    </a>
  )
}

// How far the team is from the two lines that decide the season, on the table as it stands right now
function Situation({ me, table, top6, top10 }: { me: LiveStanding; table: LiveStanding[]; top6?: number; top10?: number }) {
  const line = (n: number) => {
    if (me.rank <= n) {
      const below = table[n] // the first team outside
      const gap = below ? me.pts - below.pts : 0
      return { ok: true, txt: gap > 0 ? `${gap} p före plats ${n + 1}` : `Lika med plats ${n + 1}` }
    }
    const gap = table[n - 1].pts - me.pts
    return { ok: false, txt: gap > 0 ? `${gap} p upp till plats ${n}` : `Lika med plats ${n}` }
  }
  const rows: [string, ReturnType<typeof line>, number | undefined][] = [['Topp 6', line(6), top6], ['Slutspel', line(10), top10]]
  return (
    <div className={styles.situation}>
      <span className={styles.label}>Läget i tabellen{me.live ? ' just nu' : ''}</span>
      {rows.map(([k, l, odds]) => (
        <div key={k} className={styles.line}>
          <span className={`${styles.mark} ${l.ok ? styles.ok : ''}`} aria-hidden="true" />
          <span className={styles.lineK}>{k}</span>
          <span className={styles.lineTxt}>{l.txt}</span>
          {odds != null && <small className={styles.odds}>{oddsTxt(odds)}</small>}
        </div>
      ))}
    </div>
  )
}
