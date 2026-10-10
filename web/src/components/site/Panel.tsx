import { Clock, CloudOff } from 'lucide-react'
import type { ReactNode } from 'react'
import { EmptyState } from '@/components/arc/empty-state/empty-state'
import { useNarrow } from '@/lib/useNarrow'

// A card on a page: title row (with an optional "see more" link and subtitle), body and optional footer.
// On phones the "see more" link sits in the card's bottom corner (like the other cards there); on desktop in the header.
export function Panel({ title, sub, more, extra, foot, className = '', id, children }: {
  title?: ReactNode
  sub?: ReactNode
  more?: { href: string; label: ReactNode }
  extra?: ReactNode // other controls in the title row (a toggle), which stay there on phones
  foot?: ReactNode
  className?: string
  id?: string
  children: ReactNode
}) {
  const narrow = useNarrow()
  const low = !!more && narrow
  return (
    <section className={`panel ${className} ${low ? 'm-card' : ''}`} id={id}>
      {title && (
        <div className="p-head">
          <h2>{title}</h2>
          {extra}
          {more && !low && <MoreLink href={more.href}>{more.label}</MoreLink>}
          {sub && <p className="p-sub">{sub}</p>}
        </div>
      )}
      <div className="p-body">{children}</div>
      {foot && <div className="p-foot">{foot}</div>}
      {more && low && <a className="card-foot" href={more.href}>{more.label} ›</a>}
    </section>
  )
}

export const MoreLink = ({ href, children }: { href: string; children: ReactNode }) => <a className="more-link" href={href}>{children} ›</a>

export function Skeleton() {
  return (
    <div className="skel-page" aria-label="Laddar">
      <div className="skel skel-hero" />
      <div className="skel-grid"><div className="skel skel-card" /><div className="skel skel-card" /></div>
    </div>
  )
}

export const Empty = ({ children }: { children: ReactNode }) => <p className="empty-state">{children}</p>

// A whole page or tab with nothing to show (it failed to load, or the data isn't there yet): Arc's empty state in a card
export function PageState({ title, description, icon = 'offline' }: { title: string; description: string; icon?: 'offline' | 'later' }) {
  const glyph = icon === 'later' ? <Clock width={24} height={24} strokeWidth={1.5} /> : <CloudOff width={24} height={24} strokeWidth={1.5} />
  return <section className="panel"><EmptyState title={title} description={description} icon={glyph} /></section>
}
