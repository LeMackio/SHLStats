import { useState } from 'react'
import { useData } from '@/data/context'
import { initials } from '@/lib/format'
import { TC, tColor } from '@/lib/teams'

// Team badge: the club logo, or the code on the club colour when there is no logo (or it fails to load)
export function TeamBadge({ code, size = '' }: { code: string; size?: '' | 'md' | 'lg' | 'xl' }) {
  const { teams, tName } = useData()
  const [broken, setBroken] = useState(false)
  const [bg, fg] = TC[code] || ['#5b6b7e', '#fff']
  const logo = !broken && teams[code]?.logo
  return (
    <span className={`tb ${size} ${logo ? 'logo' : ''}`} style={{ '--tc': bg, '--tt': fg } as React.CSSProperties} title={tName(code)}>
      <span className="tb-t">{code}</span>
      {logo && <img src={logo} alt="" loading="lazy" onError={() => setBroken(true)} />}
    </span>
  )
}

export function TeamLink({ code, name = false, size = '' }: { code: string; name?: boolean; size?: '' | 'md' | 'lg' | 'xl' }) {
  const { tName } = useData()
  return (
    <a className="teamlink" href={`#/lag/${encodeURIComponent(code)}`}>
      <TeamBadge code={code} size={size} />
      {name && <span>{tName(code)}</span>}
    </a>
  )
}

// Small round headshot on a team-tinted disc; the initials show when there is no photo or it fails to load
export function Avatar({ id, name, team, size = '' }: { id?: string | null; name: string; team: string; size?: '' | 'md' }) {
  const { headshots } = useData()
  const [state, setState] = useState<'loading' | 'in' | 'broken'>('loading')
  const h = id ? headshots[id] : undefined
  const ini = initials(name)
  return (
    <span className={`av ${size}`} style={{ '--tc': tColor(team) } as React.CSSProperties} data-ini={ini}>
      {h && state !== 'broken'
        ? <img src={h[0]} alt="" loading="lazy" className={state === 'in' ? 'in' : undefined} onLoad={() => setState('in')} onError={() => setState('broken')} />
        : ini}
    </span>
  )
}
