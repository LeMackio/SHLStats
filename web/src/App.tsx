import { Component, lazy, Suspense, useEffect, useRef, useState, type ComponentType, type ReactNode } from 'react'
import { BottomNav, Footer } from '@/components/site/BottomNav'
import { Header } from '@/components/site/Header'
import { Panel, Skeleton } from '@/components/site/Panel'
import { SearchPalette } from '@/components/site/SearchPalette'
import { SettingsSheet } from '@/components/site/SettingsSheet'
import { Strip } from '@/components/site/Strip'
import { VideoDialog } from '@/components/site/VideoDialog'
import { useData } from '@/data/context'
import { useAppMode, useBodyClass, useCompactNav, usePullToRefresh } from '@/lib/appHooks'
import { usePageName } from '@/lib/pageTitle'
import { segOf, SUB_PAGES, TITLES, usePath } from '@/lib/router'
import { NotFound } from '@/pages/NotFound'

// Each page is its own file, loaded the first time it is opened, so the first visit only downloads what it shows.
// After a new version is published, files of the old one are gone: a page that fails to load then reloads the
// site once, which brings the new version.
const reloaded = {
  get: () => { try { return !!sessionStorage.getItem('shlstats-reloaded') } catch { return true } }, // no storage: never loop
  set: (on: boolean) => { try { if (on) sessionStorage.setItem('shlstats-reloaded', '1'); else sessionStorage.removeItem('shlstats-reloaded') } catch { /* private mode */ } },
}
const page = <P extends object>(load: () => Promise<ComponentType<P>>) => lazy(() => load().then(
  (C) => { reloaded.set(false); return { default: C } },
  (e) => {
    if (!reloaded.get()) { reloaded.set(true); location.reload() }
    throw e
  },
))
const HemPage = page(() => import('@/pages/Hem').then((m) => m.HemPage))
const LagPage = page(() => import('@/pages/Lag').then((m) => m.LagPage))
const MatchPage = page(() => import('@/pages/Match').then((m) => m.MatchPage))
const MatcherPage = page(() => import('@/pages/Matcher').then((m) => m.MatcherPage))
const MediaPage = page(() => import('@/pages/Media').then((m) => m.MediaPage))
const NexusPage = page(() => import('@/pages/Nexus').then((m) => m.NexusPage))
const NyheterPage = page(() => import('@/pages/Nyheter').then((m) => m.NyheterPage))
const SpelarePage = page(() => import('@/pages/Spelare').then((m) => m.SpelarePage))
const StatistikPage = page(() => import('@/pages/Statistik').then((m) => m.StatistikPage))
const TabellPage = page(() => import('@/pages/Tabell').then((m) => m.TabellPage))

// Every address of the original site, so old links keep working. Each entry gets the path's captured parts.
const ROUTES: [RegExp, (m: string[]) => ReactNode][] = [
  [/^\/?$/, () => <HemPage />],
  [/^\/matcher(?:\/([^/]+))?$/, ([view]) => <MatcherPage view={view} />],
  [/^\/match\/([^/]+)(?:\/([^/]+))?$/, ([id, tab]) => <MatchPage id={id} tab={tab} />],
  [/^\/tabell(?:\/([^/]+))?$/, ([tab]) => <TabellPage tab={tab} />],
  [/^\/statistik$/, () => <StatistikPage />],
  [/^\/spelare\/([^/]+)(?:\/([^/]+))?$/, ([id, tab]) => <SpelarePage id={id} tab={tab} />],
  [/^\/(?:nexus|avancerat)(?:\/([^/]+))?$/, ([tab]) => <NexusPage tab={tab} />], // /avancerat is the old address
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
  useCompactNav()
  usePullToRefresh()
  useAppMode(core.updated)
  useScrollOnNavigate(path)

  // Pages with their own name (a player, a team) set it themselves; the rest are named after their section
  const pageName = usePageName(path)
  useEffect(() => { const t = pageName || TITLES[seg]; document.title = t ? `${t} · SHLstats` : 'SHLstats' }, [seg, pageName])

  return (
    <>
      <Strip />
      <Header path={path} onSearch={() => setSearchOpen(true)} onSettings={() => setSettingsOpen(true)} />
      <main id="app">
        <PageErrorBoundary key={path}><Suspense fallback={<Skeleton />}>{renderRoute(path)}</Suspense></PageErrorBoundary>
      </main>
      <Footer stamp={stamp} />
      <BottomNav path={path} />
      <SettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <VideoDialog />
      <SearchPalette open={searchOpen} onOpenChange={setSearchOpen} />
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
