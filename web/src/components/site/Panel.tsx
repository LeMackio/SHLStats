import type { ReactNode } from 'react'

// A card on a page: title row (with an optional "see more" link and subtitle), body and optional footer
export function Panel({ title, sub, more, foot, className = '', id, children }: {
  title?: ReactNode
  sub?: ReactNode
  more?: ReactNode
  foot?: ReactNode
  className?: string
  id?: string
  children: ReactNode
}) {
  return (
    <section className={`panel ${className}`} id={id}>
      {title && <div className="p-head"><h2>{title}</h2>{more}{sub && <p className="p-sub">{sub}</p>}</div>}
      <div className="p-body">{children}</div>
      {foot && <div className="p-foot">{foot}</div>}
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
