import { Component, useEffect, useRef, useState, type ReactNode } from 'react'
import { BottomNav, Footer } from '@/components/site/BottomNav'
import { Header } from '@/components/site/Header'
import { Panel } from '@/components/site/Panel'
import { SettingsSheet } from '@/components/site/SettingsSheet'
import { Strip } from '@/components/site/Strip'
import { VideoDialog } from '@/components/site/VideoDialog'
import { useData } from '@/data/context'
import { useBodyClass, useCompactNav, usePullToRefresh, useReloadWhenStale } from '@/lib/appHooks'
import { usePageName } from '@/lib/pageTitle'
import { segOf, SUB_PAGES, TITLES, usePath } from '@/lib/router'
import { HemPage } from '@/pages/Hem'
import { LagPage } from '@/pages/Lag'
import { MatchPage } from '@/pages/Match'
import { MatcherPage } from '@/pages/Matcher'
import { MediaPage } from '@/pages/Media'
import { NyheterPage } from '@/pages/Nyheter'
import { SpelarePage } from '@/pages/Spelare'
import { NotFound, NotYetPorted } from '@/pages/NotYetPorted'
import { StatistikPage } from '@/pages/Statistik'
import { TabellPage } from '@/pages/Tabell'

// Every address of the original site, so old links keep working. Each entry gets the path's captured parts.
const ROUTES: [RegExp, (m: string[]) => ReactNode][] = [
  [/^\/?$/, () => <HemPage />],
  [/^\/matcher(?:\/([^/]+))?$/, ([view]) => <MatcherPage view={view} />],
  [/^\/match\/([^/]+)(?:\/([^/]+))?$/, ([id, tab]) => <MatchPage id={id} tab={tab} />],
  [/^\/tabell(?:\/([^/]+))?$/, ([tab]) => <TabellPage tab={tab} />],
  [/^\/statistik$/, () => <StatistikPage />],
  [/^\/spelare\/([^/]+)(?:\/([^/]+))?$/, ([id, tab]) => <SpelarePage id={id} tab={tab} />],
  [/^\/(?:nexus|avancerat)$/, () => <NotYetPorted name="Nexus" />], // /avancerat is the old address
  [/^\/nyheter\/([^/]+)$/, ([id]) => <NyheterPage id={id} />],
  [/^\/media(?:\/([^/]+))?$/, ([range]) => <MediaPage range={range} />],
  [/^\/lag$/, () => <TabellPage tab="" />], // old link to the teams page, now the Tabell page
  [/^\/lag\/([^/]+)(?:\/([^/]+))?$/, ([code, tab]) => <LagPage code={code} tab={tab} />],
]

function renderRoute(path: string) {
  for (const [re, page] of ROUTES) {
    const m = path.match(re)
    if (m) return page(m.slice(1).map((x) => x ?? ''))
  }
  return <NotFound />
}

export default function App() {
  const { stamp, core } = useData()
  const path = usePath()
  const seg = segOf(path)
  const [searchOpen, setSearchOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)

  useBodyClass('is-home', path === '/') // the settings button shows on Hem (phones)
  useBodyClass('is-sub', SUB_PAGES.includes(seg))
  useBodyClass('search-open', searchOpen)
  useCompactNav()
  usePullToRefresh()
  useReloadWhenStale(core.updated)
  useScrollOnNavigate(path)

  // Pages with their own name (a player, a team) set it themselves; the rest are named after their section
  const pageName = usePageName(path)
  useEffect(() => { const t = pageName || TITLES[seg]; document.title = t ? `${t} · SHLstats` : 'SHLstats' }, [seg, pageName])

  return (
    <>
      <Strip />
      <Header path={path} searchOpen={searchOpen} setSearchOpen={setSearchOpen} onSettings={() => setSettingsOpen(true)} />
      <main id="app">
        <PageErrorBoundary key={path}>{renderRoute(path)}</PageErrorBoundary>
      </main>
      <Footer stamp={stamp} />
      <BottomNav path={path} />
      <SettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <VideoDialog />
    </>
  )
}

// A new page starts at the top; switching tabs within the same page keeps the scroll position near the tabs
function useScrollOnNavigate(path: string) {
  const last = useRef(path)
  useEffect(() => {
    const page = (p: string) => p.split('/').slice(0, 3).join('/')
    if (page(path) !== page(last.current)) window.scrollTo(0, 0)
    last.current = path
  }, [path])
}

// One broken page shows a message instead of taking the whole site down
class PageErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }
  static getDerivedStateFromError(error: Error) { return { error } }
  componentDidCatch(error: Error) { console.error(error) }
  render() {
    if (!this.state.error) return this.props.children
    return (
      <Panel title="Något gick fel">
        <p>Sidan kunde inte visas. Ladda om sidan och försök igen.</p>
        <p className="faint">{this.state.error.message}</p>
      </Panel>
    )
  }
}
