import { useEffect, useMemo, useState } from 'react'
import { useData } from '@/data/context'
import { liveClock, loadLive, type LiveData } from '@/data/live'
import { dateParts, fmtDay, fmtTime, todayStr } from '@/lib/format'
import { liveTable } from '@/lib/liveTable'
import { tColor } from '@/lib/teams'
import { isFinal, isLive, type Game } from '@/lib/types'
import { TeamBadge } from './TeamBadge'
import styles from './TeamNow.module.css'

const ordinal = (n: number) => `${n}:${n === 1 || n === 2 ? 'a' : 'e'}`
const whenTxt = (g: Game) => {
  const d = g.start.slice(0, 10), diff = Math.round((Date.parse(d) - Date.parse(todayStr())) / 864e5)
  const day = diff === 0 ? 'Idag' : diff === 1 ? 'I morgon' : fmtDay(d)
  return `${day[0].toUpperCase()}${day.slice(1)} ${fmtTime(g.start)}`
}

// The followed team's card at the top of Hem: three things, drawn the same way. The next game (or the game being
// played), the latest result, and the form over the last five games.
export function TeamNow({ f, onUnfollow }: { f: string; onUnfollow: () => void }) {
  const { core, games, tName, teams } = useData()
  const table = useMemo(() => liveTable(core, games), [core, games])
  const rankOf = (c: string) => table.find((r) => r.code === c)?.rank
  const me = table.find((r) => r.code === f)!
  const mine = (g: Game) => g.home === f || g.away === f
  const live = games.find((g) => isLive(g) && mine(g))
  const next = games.find((g) => !isFinal(g) && !isLive(g) && mine(g))
  const played = games.filter((g) => isFinal(g) && mine(g))
  const last = played[played.length - 1]
  const five = played.slice(-5)

  // The live clock for a game being played
  const [L, setL] = useState<LiveData | null>(null)
  useEffect(() => {
    if (!live) return
    let off = false
    loadLive(live.id).then((x) => { if (!off) setL(x) })
    return () => { off = true }
  }, [live?.id, live?.hs, live?.as]) // eslint-disable-line react-hooks/exhaustive-deps

  const side = (g: Game) => {
    const home = g.home === f
    return { home, opp: home ? g.away : g.home, us: (home ? g.hs : g.as) ?? 0, them: (home ? g.as : g.hs) ?? 0 }
  }
  const game = live || next
  const G = game && side(game)
  const R = last && side(last)
  // Form: wins, losses and goals over the last five games
  const form = five.map((g) => { const s = side(g); return { g, won: s.us > s.them, extra: !!(g.ot || g.so), us: s.us, them: s.them } })
  const wins = form.filter((x) => x.won).length, gf = form.reduce((n, x) => n + x.us, 0), ga = form.reduce((n, x) => n + x.them, 0)

  return (
    <div className={`mday-side mts ${styles.card}`} style={{ '--tc': tColor(f) } as React.CSSProperties}>
      <a className="mts-hero" href={`#/lag/${f}`}>
        {teams[f]?.logo && <img className="mts-logo" src={teams[f].logo} alt="" />}
        <b className="mts-name" style={{ '--n': tName(f).length } as React.CSSProperties}>{tName(f)}</b>
        <span className="mts-pos"><span className="mts-rank">{me.rank}</span>{me.pts} poäng · {me.gp} matcher</span>
      </a>
      <div className={styles.body}>
        {game && G && (
          <a className={styles.row} href={`#/match/${game.id}`}>
            <span className={styles.label}>{live ? <><i className="live-dot" />Pågår · {liveClock(L)}</> : `Nästa match · ${whenTxt(game)}`}</span>
            <span className={styles.line}>
              <TeamBadge code={G.opp} size="md" />
              <span className={styles.main}><b>{tName(G.opp)}</b><small>{G.home ? 'Hemma' : 'Borta'}{rankOf(G.opp) ? ` · ${ordinal(rankOf(G.opp)!)} i tabellen` : ''}</small></span>
              {live && <b className={`${styles.big} num`}>{G.us}–{G.them}</b>}
            </span>
          </a>
        )}
        {last && R && (
          <a className={styles.row} href={`#/match/${last.id}`}>
            <span className={styles.label}>Senaste match · {dateParts(last.start).d}/{dateParts(last.start).m}</span>
            <span className={styles.line}>
              <TeamBadge code={R.opp} size="md" />
              <span className={styles.main}><b>{tName(R.opp)}</b><small>{R.home ? 'Hemma' : 'Borta'}</small></span>
              <span className={styles.result}>
                <span className={`${styles.res} ${R.us > R.them ? styles.w : styles.l}`}>{R.us > R.them ? 'V' : 'F'}</span>
                <b className={`${styles.big} num`}>{R.us}–{R.them}</b>
                {last.ot || last.so ? <small>{last.so ? 'str' : 'ÖT'}</small> : null}
              </span>
            </span>
          </a>
        )}
        {form.length > 0 && (
          <div className={styles.row}>
            <span className={styles.label}>Form · senaste {form.length}</span>
            <span className={styles.line}>
              <span className={styles.chips}>
                {form.map((x) => (
                  <a key={x.g.id} href={`#/match/${x.g.id}`} className={`${styles.res} ${x.won ? styles.w : styles.l}`} title={`${x.us}–${x.them}${x.extra ? ' efter övertid' : ''}`}>{x.won ? 'V' : 'F'}</a>
                ))}
              </span>
              <span className={styles.stats}>
                <span><b className="num">{wins}–{form.length - wins}</b><small>vinster</small></span>
                <span><b className="num">{gf}–{ga}</b><small>mål</small></span>
              </span>
            </span>
          </div>
        )}
        <div className={styles.foot}><button className="linkbtn" onClick={onUnfollow}>Sluta följa</button><a className="more-link" href={`#/lag/${f}`}>Lagsidan ›</a></div>
      </div>
    </div>
  )
}
