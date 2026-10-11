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

// While a page loads: the same shapes as what is coming (the header card, then cards with a title and rows), so
// nothing jumps when the content arrives. kind: "profile" for team and player pages, "match" for a game, else a page.
const SkelLine = ({ w, h = 12 }: { w: string; h?: number }) => <span className="skel skel-line" style={{ width: w, height: h }} />
function SkelCard({ rows = 5, i = 0 }: { rows?: number; i?: number }) {
  return (
    <section className="panel skel-panel" aria-hidden="true">
      <div className="skel-head"><SkelLine w="38%" h={16} /><SkelLine w="62%" h={11} /></div>
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className="skel-row"><span className="skel skel-dot" /><SkelLine w={`${48 + ((r * 17 + i * 11) % 34)}%`} /><SkelLine w="14%" /></div>
      ))}
    </section>
  )
}
export function Skeleton({ kind = 'page' }: { kind?: 'page' | 'profile' | 'match' }) {
  return (
    <div className="skel-page" role="status" aria-label="Laddar">
      {kind === 'profile' && (
        <div className="skel-hero skel-ref" aria-hidden="true">
          <div className="skel-ref-text"><SkelLine w="90px" h={11} /><SkelLine w="min(360px, 70%)" h={38} /><div className="skel-stats">{[0, 1, 2].map((k) => <span key={k}><SkelLine w="52px" h={10} /><SkelLine w="44px" h={28} /></span>)}</div></div>
          <span className="skel skel-mark" />
          <div className="skel-tabs">{[70, 64, 56, 52, 60].map((w, k) => <SkelLine key={k} w={`${w}px`} h={10} />)}</div>
        </div>
      )}
      {kind === 'match' && (
        <div className="skel-hero skel-match" aria-hidden="true">
          <span className="skel skel-badge" /><SkelLine w="120px" h={52} /><span className="skel skel-badge" />
        </div>
      )}
      {kind === 'page' && <SkelLine w="min(280px, 60%)" h={30} />}
      <div className="skel-grid">{[6, 4, 5, 3].map((n, i) => <SkelCard key={i} rows={n} i={i} />)}</div>
    </div>
  )
}

export const Empty = ({ children }: { children: ReactNode }) => <p className="empty-state">{children}</p>

// A whole page or tab with nothing to show (it failed to load, or the data isn't there yet): Arc's empty state in a card
export function PageState({ title, description, icon = 'offline' }: { title: string; description: string; icon?: 'offline' | 'later' }) {
  const glyph = icon === 'later' ? <Clock width={24} height={24} strokeWidth={1.5} /> : <CloudOff width={24} height={24} strokeWidth={1.5} />
  return <section className="panel"><EmptyState title={title} description={description} icon={glyph} /></section>
}
