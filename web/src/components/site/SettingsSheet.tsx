import { useState } from 'react'
import { BottomSheet } from '@/components/arc/bottom-sheet/bottom-sheet'
import { Button } from '@/components/arc/button/button'
import SegmentedControl from '@/components/arc/segmented-control/segmented-control'
import { Switch } from '@/components/arc/switch/switch'
import { useData } from '@/data/context'
import { pushOff, pushOk, pushPrefs, pushSave, type PushPrefs } from '@/lib/push'
import { useTheme, type ThemeChoice } from '@/lib/theme'
import styles from './SettingsSheet.module.css'
import { TeamBadge } from './TeamBadge'

const THEME_OPTIONS: { value: ThemeChoice; label: string }[] = [
  { value: 'dark', label: 'Mörkt' }, { value: 'light', label: 'Ljust' }, { value: 'auto', label: 'Auto' },
]

// Phones: the settings (theme, your team, notifications) in Arc's bottom sheet, opened from the gear on Hem
export function SettingsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { codes, tName, fav, setFav, stamp } = useData()
  const { choice, setTheme } = useTheme()

  const pickTeam = (code: string | null) => {
    setFav(code)
    if (pushPrefs()) (code ? pushSave(code, pushPrefs()!) : pushOff()).catch(() => {}) // notifications follow the chosen team
  }

  return (
    <BottomSheet open={open} onOpenChange={(v) => { if (!v) onClose() }} title="Inställningar" closeLabel="Stäng" detents={[0.62, 0.94]}>
      <section className={styles.group}>
        <h3 className={styles.heading}>Tema</h3>
        <SegmentedControl label="Tema" options={THEME_OPTIONS} value={choice} onValueChange={(v) => setTheme(v as ThemeChoice)} />
      </section>
      <section className={styles.group}>
        <h3 className={styles.heading} id="set-team">Följ ett lag</h3>
        <div className={styles.teams} role="radiogroup" aria-labelledby="set-team">
          {[...codes].sort((a, b) => tName(a).localeCompare(tName(b), 'sv')).map((c) => (
            <button key={c} className={styles.team} role="radio" aria-checked={fav === c} onClick={() => pickTeam(c)}>
              <TeamBadge code={c} size="md" /><span>{tName(c)}</span>
            </button>
          ))}
          <button className={styles.team} role="radio" aria-checked={!fav} onClick={() => pickTeam(null)}>
            <span className={styles.none} aria-hidden="true">–</span><span>Inget lag</span>
          </button>
        </div>
      </section>
      <section className={styles.group}>
        <h3 className={styles.heading}>Notiser</h3>
        <PushSection team={fav} teamName={fav ? tName(fav) : ''} />
      </section>
      <section className={styles.group}>
        <h3 className={styles.heading}>Om SHLstats</h3>
        <p className={styles.note}>Uppdaterad {stamp}.</p>
        <Button variant="secondary" onClick={() => location.reload()}>Hämta senaste</Button>
        <p className={styles.note}>SHLstats är ett fristående fanprojekt utan koppling till SHL. Resultat, statistik, bilder och videor från shl.se. Prognoserna bygger på en egen modell och är inga garantier.</p>
      </section>
    </BottomSheet>
  )
}

function PushSection({ team, teamName }: { team: string | null; teamName: string }) {
  const [prefs, setPrefs] = useState<PushPrefs | null>(pushPrefs)
  const [state, setState] = useState<'idle' | 'busy' | 'failed'>('idle')

  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent)
  const standalone = matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone
  if (ios && !standalone) return <p className={styles.note}>På iPhone fungerar notiser när SHLstats ligger på hemskärmen: tryck på Dela, välj Lägg till på hemskärmen, öppna appen därifrån och slå på notiserna här.</p>
  if (!pushOk()) return <p className={styles.note}>Den här webbläsaren stöder inte notiser.</p>
  if (!team) return <p className={styles.note}>Välj ett lag ovan så kan du få notiser om lagets matcher.</p>
  if (Notification.permission === 'denied') return <p className={styles.note}>Notiser är blockerade för SHLstats i telefonens inställningar.</p>
  if (!prefs) return <>
    {/* The button confirms in place: it shows its own pending state while the phone asks for permission */}
    <Button loading={state === 'busy'} onClick={() => {
      const p = { start: true, goals: true, final: true }
      setState('busy')
      pushSave(team, p).then(() => { setPrefs(p); setState('idle') }, () => setState('failed'))
    }}>Slå på notiser för {teamName}</Button>
    <p className={styles.note}>{state === 'failed' ? 'Det gick inte att slå på notiser. Försök igen om en stund.' : 'Mål, en påminnelse en timme före nedsläpp och slutresultatet.'}</p>
  </>
  const toggle = (k: keyof PushPrefs, label: string) => (
    <div className={styles.toggle}>
      <Switch label={label} checked={prefs[k] !== false} onCheckedChange={(on) => {
        const next = { ...prefs, [k]: on }
        setPrefs(next)
        pushSave(team, next).catch(() => setPrefs(prefs))
      }} />
    </div>
  )
  return <>
    <div className={styles.toggles}>{toggle('start', 'Påminnelse före matchen')}{toggle('goals', 'Mål')}{toggle('final', 'Slutresultat')}</div>
    <Button variant="secondary" onClick={() => pushOff().then(() => setPrefs(null))}>Stäng av notiser</Button>
  </>
}
