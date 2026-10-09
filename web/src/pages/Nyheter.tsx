import { Panel } from '@/components/site/Panel'
import { useData } from '@/data/context'
import { dateParts, fmtDay } from '@/lib/format'
import { safeUrl } from '@/lib/game'
import { usePageTitle } from '@/lib/pageTitle'
import { NotFound } from './NotFound'

// A news item on this site: headline, image and the SHL's own intro, with the full article on shl.se
export function NyheterPage({ id }: { id: string }) {
  const { core } = useData()
  const news = core.news || []
  const n = news.find((x) => x.id === id)
  usePageTitle(n?.title, { phone: false })
  if (!n) return <NotFound msg="Nyheten finns inte längre bland de senaste nyheterna." />
  const url = safeUrl(n.url), others = news.filter((x) => x.id !== id)
  return (
    <>
      <div className="crumbs"><a href="#/">Översikt</a> / Nyheter</div>
      <article className="panel narticle">
        {n.img && <img className="narticle-img" src={n.img} alt="" />}
        <div className="narticle-body">
          <span className="mini-lbl">{n.label ? `${n.label} · ` : ''}{fmtDay(n.date)} {dateParts(n.date).y}</span>
          <h1>{n.title}</h1>
          <p className="narticle-intro">{n.intro}</p>
          {url && <a className="btn" href={url} target="_blank" rel="noopener">Läs hela artikeln på shl.se ↗</a>}
          <p className="note">Artikeln är skriven av SHL och publiceras på shl.se.</p>
        </div>
      </article>
      {others.length > 0 && (
        <Panel title="Fler nyheter">
          <div className="nlist">
            {others.map((o) => (
              <a key={o.id} className="nitem" href={`#/nyheter/${encodeURIComponent(o.id)}`}>
                {o.img ? <img src={o.img} alt="" loading="lazy" /> : <span />}
                <span><span className="mini-lbl">{fmtDay(o.date)}</span><b>{o.title}</b></span>
              </a>
            ))}
          </div>
        </Panel>
      )}
    </>
  )
}
