import { useEffect, useRef, useState } from 'react'
import { useData } from '@/data/context'
import { pushOff, pushOk, pushPrefs, pushSave, type PushPrefs } from '@/lib/push'
import { useTheme, type ThemeChoice } from '@/lib/theme'
import { SlideIndicator } from './SlideIndicator'
import { TeamBadge } from './TeamBadge'

const THEME_OPTIONS: [ThemeChoice, string][] = [['dark', 'Mörkt'], ['light', 'Ljust'], ['paper', 'Papper'], ['auto', 'Auto']]

// Phones: the settings sheet (theme, your team, notifications), opened from the gear on Hem
export function SettingsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const dlg = useRef<HTMLDialogElement>(null)
  const { codes, tName, fav, setFav, stamp } = useData()
  const { choice, setTheme } = useTheme()

  useEffect(() => {
    const d = dlg.current
    if (!d) return
    if (open && !d.open) d.showModal()
    else if (!open && d.open) d.close()
  }, [open])

  const pickTeam = (code: string | null) => {
    setFav(code)
    if (pushPrefs()) (code ? pushSave(code, pushPrefs()!) : pushOff()).catch(() => {}) // notifications follow the chosen team
  }

  return (
    <dialog className="sheet" ref={dlg} aria-label="Inställningar" onClose={onClose} onCancel={(e) => { e.preventDefault(); onClose() }} onClick={(e) => { if (e.target === dlg.current) onClose() }}>
      {open && (
        <div className="sheet-in">
          <div className="sheet-grab" aria-hidden="true" />
          <div className="sheet-head"><h2>Inställningar</h2><button className="sheet-close" onClick={onClose}>Klar</button></div>
          <h3>Tema</h3>
          <div className="seg sheet-seg has-ind">
            <SlideIndicator kind="pill" active='[aria-pressed="true"]' groupKey="set-theme" dep={choice} />
            {THEME_OPTIONS.map(([v, l]) => <button key={v} aria-pressed={choice === v} onClick={() => setTheme(v)}>{l}</button>)}
          </div>
          <h3>Mitt lag</h3>
          <div className="set-teams">
            {[...codes].sort((a, b) => tName(a).localeCompare(tName(b), 'sv')).map((c) => (
              <button key={c} aria-pressed={fav === c} onClick={() => pickTeam(c)}><TeamBadge code={c} size="md" /><span>{tName(c)}</span></button>
            ))}
            <button aria-pressed={!fav} onClick={() => pickTeam(null)}><span className="set-none">–</span><span>Inget lag</span></button>
          </div>
          <h3>Notiser</h3>
          <PushSection team={fav} teamName={fav ? tName(fav) : ''} />
          <h3>Om SHLstats</h3>
          <div className="set-about">
            <p>Uppdaterad {stamp}.</p>
            <button className="sheet-btn" onClick={() => location.reload()}>Hämta senaste</button>
            <p>SHLstats är ett fristående fanprojekt utan koppling till SHL. Resultat, statistik, bilder och videor från shl.se. Prognoserna bygger på en egen modell och är inga garantier.</p>
          </div>
        </div>
      )}
    </dialog>
  )
}

function PushSection({ team, teamName }: { team: string | null; teamName: string }) {
  const [prefs, setPrefs] = useState<PushPrefs | null>(pushPrefs)
  const [note, setNote] = useState('')

  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent)
  const standalone = matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone
  let body: React.ReactNode
  if (note) body = <p className="set-note">{note}</p>
  else if (ios && !standalone) body = <p className="set-note">På iPhone fungerar notiser när SHLstats ligger på hemskärmen: tryck på Dela, välj Lägg till på hemskärmen, öppna appen därifrån och slå på notiserna här.</p>
  else if (!pushOk()) body = <p className="set-note">Den här webbläsaren stöder inte notiser.</p>
  else if (!team) body = <p className="set-note">Välj ett lag ovan så kan du få notiser om lagets matcher.</p>
  else if (Notification.permission === 'denied') body = <p className="set-note">Notiser är blockerade för SHLstats i telefonens inställningar.</p>
  else if (!prefs) body = <>
    <button className="sheet-btn" onClick={() => {
      const p = { start: true, goals: true, final: true }
      setNote('Slår på…')
      pushSave(team, p).then(() => { setPrefs(p); setNote('') }, () => setNote('Det gick inte att slå på notiser. Försök igen om en stund.'))
    }}>Slå på notiser för {teamName}</button>
    <p className="set-note">Mål, en påminnelse en timme före nedsläpp och slutresultatet.</p>
  </>
  else {
    const tog = (k: keyof PushPrefs, label: string) => (
      <label className="set-tog"><span>{label}</span>
        <input type="checkbox" checked={prefs[k] !== false} onChange={(e) => {
          const next = { ...prefs, [k]: e.target.checked }
          setPrefs(next)
          pushSave(team, next).catch(() => setPrefs(prefs))
        }} /><i aria-hidden="true" />
      </label>
    )
    body = <>
      <div className="set-togs">{tog('start', 'Påminnelse före matchen')}{tog('goals', 'Mål')}{tog('final', 'Slutresultat')}</div>
      <button className="sheet-btn" onClick={() => pushOff().then(() => setPrefs(null))}>Stäng av notiser</button>
    </>
  }
  return <div id="set-push">{body}</div>
}
