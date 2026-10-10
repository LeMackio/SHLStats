import { Children, useLayoutEffect, useRef, type ReactNode } from 'react'
import SegmentedControl from '@/components/arc/segmented-control/segmented-control'
import { go } from '@/lib/router'
import { Icon } from './Icon'
import switchStyles from './Switch.module.css'
import { SlideIndicator } from './SlideIndicator'

export function PageHead({ title, children }: { title: ReactNode; children?: ReactNode }) {
  return <div className="page-head"><div><h1>{title}</h1>{children && <p>{children}</p>}</div></div>
}

// Masonry board: each item spans rows equal to its measured height, so shorter panels slot into the
// shortest column and no holes are left between them
const ROW = 4, GAP = 20
export function Board({ className = '', children }: { className?: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const items = Children.toArray(children).filter(Boolean)
  useLayoutEffect(() => {
    const box = ref.current
    if (!box) return
    const span = (el: Element) => { (el as HTMLElement).style.gridRowEnd = `span ${Math.max(1, Math.ceil((el.getBoundingClientRect().height + GAP) / ROW))}` }
    const ro = new ResizeObserver((entries) => { for (const e of entries) span(e.target) })
    ;[...box.children].forEach((el, i) => {
      (el as HTMLElement).style.setProperty('--i', String(Math.min(i, 10))) // staggered fade-in
      span(el)
      ro.observe(el)
    })
    return () => ro.disconnect()
  })
  return <div className={`board ${className}`} ref={ref}>{items}</div>
}

const TAB_ICON: Record<string, string> = {
  '': 'grid', video: 'play', spelare: 'users', skott: 'target', uppstallning: 'users', inbordes: 'swap', trupp: 'users',
  schema: 'calendar', historik: 'clock', karriar: 'chart', form: 'chart', matchlogg: 'list', mal: 'play', spelade: 'list', alla: 'calendar',
}
export type TabDef = { key: string; label: ReactNode; count?: ReactNode; icon?: string }

// A row of tabs that are links (#/tabell, #/tabell/odds …), underlined with a sliding line
export function RouteTabs({ base, tabs, active }: { base: string; tabs: TabDef[]; active: string }) {
  const ref = useRef<HTMLElement>(null)
  // Wider than the screen (phones): scroll so the open tab is in view
  useLayoutEffect(() => {
    const t = ref.current, on = t?.querySelector<HTMLElement>('a.on')
    if (t && on && t.scrollWidth > t.clientWidth) t.scrollLeft = on.offsetLeft - (t.clientWidth - on.offsetWidth) / 2
  }, [active])
  return (
    <nav className="tabs has-ind" aria-label="Flikar" ref={ref}>
      <SlideIndicator kind="line" active=".on" groupKey={`tabs${base}`} dep={active} />
      {tabs.map((t) => (
        <a key={t.key} href={`#${base}${t.key ? '/' + t.key : ''}`} className={t.key === active ? 'on' : undefined} aria-current={t.key === active ? 'page' : undefined}>
          <Icon name={t.icon || TAB_ICON[t.key]} />{t.label}{t.count ? <span className="count">{t.count}</span> : null}
        </a>
      ))}
    </nav>
  )
}

// A page's views (#/tabell, #/tabell/odds …) as Arc's segmented control: full width on phones
export function PageSwitch({ base, tabs, active, label = 'Visa' }: { base: string; tabs: { key: string; label: string }[]; active: string; label?: string }) {
  return (
    <div className="page-switch">
      <SegmentedControl className={switchStyles.fill} label={label} value={active} onValueChange={(k) => go(`#${base}${k ? '/' + k : ''}`)}
        options={tabs.map((t) => ({ value: t.key, label: t.label }))} />
    </div>
  )
}

// The same link tabs drawn as a pill toggle (phones)
export function SegLinks({ base, tabs, active }: { base: string; tabs: TabDef[]; active: string }) {
  return (
    <nav className="seg seg-links has-ind" aria-label="Flikar">
      <SlideIndicator kind="pill" active=".on" groupKey={`seg-links${base}`} dep={active} />
      {tabs.map((t) => (
        <a key={t.key} href={`#${base}${t.key ? '/' + t.key : ''}`} className={t.key === active ? 'on' : undefined} aria-current={t.key === active ? 'page' : undefined}>{t.label}</a>
      ))}
    </nav>
  )
}

// A pill toggle of buttons: Arc's segmented control (a label that isn't plain text, such as a badge, goes after it)
export function Seg<T extends string>({ options, value, onChange, className = '', id, label, fill = false }: {
  options: [T, ReactNode][]
  value: T
  onChange: (v: T) => void
  className?: string
  id?: string
  label?: string
  fill?: boolean // phones: the full width, split evenly
}) {
  return (
    <div className={`seg-wrap ${className}`} id={id}>
      <SegmentedControl className={fill ? switchStyles.fill : undefined} label={label} value={value} onValueChange={(v) => onChange(v as T)}
        options={options.map(([v, l]) => (typeof l === 'string' ? { value: v, label: l } : { value: v, label: '', accessory: l }))} />
    </div>
  )
}
