import type { ReactNode } from 'react'
import { useData } from '@/data/context'
import { SlideIndicator } from './SlideIndicator'
import { TeamBadge } from './TeamBadge'

// Two-team toggle (line-ups and player stats): shows one team's pane at a time (the side comes from useTeamSide)
export function TeamToggle({ home, away, side, setSide, panes }: {
  home: string
  away: string
  side: 'home' | 'away'
  setSide: (s: 'home' | 'away') => void
  panes: { home: ReactNode; away: ReactNode }
}) {
  const { tName } = useData()
  return (
    <div className="tt">
      <div className="seg tt-seg has-ind">
        <SlideIndicator kind="pill" active='[aria-pressed="true"]' groupKey={`tt-${home}-${away}`} dep={side} />
        {(['home', 'away'] as const).map((s) => {
          const c = s === 'home' ? home : away
          return <button key={s} aria-pressed={s === side} onClick={() => setSide(s)}><TeamBadge code={c} />{tName(c)}</button>
        })}
      </div>
      <div data-pane="home" hidden={side !== 'home'}>{panes.home}</div>
      <div data-pane="away" hidden={side !== 'away'}>{panes.away}</div>
    </div>
  )
}
