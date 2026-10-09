import { LIVE_API } from '@/data/live'
import { store } from './format'

// Push notifications for the followed team: goals, a reminder an hour before face-off and the final score.
// The phone subscribes with the relay's public key; the relay (live-relay/worker.js) sends the notifications.
const PUSH_KEY = 'BARCN0YCm1MnhdNyXAnQDogwCnZn4YZdo7THDN66637H3iPSF3REMImTKFqB35jG5v6X6rDRNq2nfXBi4B3OyAU'

export type PushPrefs = { start?: boolean; goals?: boolean; final?: boolean }

// Notifications need the service worker, which is only registered on the built site (not in `npm run dev`)
export const pushOk = () => import.meta.env.PROD && !!LIVE_API && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
export const pushPrefs = (): PushPrefs | null => { try { return JSON.parse(store.get('shlstats-push') || 'null') } catch { return null } }

const urlB64 = (s: string) => {
  const b = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4))
  return Uint8Array.from(b, (c) => c.charCodeAt(0))
}

export async function pushSave(team: string | null, prefs: PushPrefs) {
  if (!pushOk() || !team) throw new Error('not available')
  if (Notification.permission !== 'granted' && (await Notification.requestPermission()) !== 'granted') throw new Error('not allowed')
  const reg = await navigator.serviceWorker.ready
  const sub = (await reg.pushManager.getSubscription()) || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64(PUSH_KEY) }))
  const r = await fetch(`${LIVE_API}/push/subscribe`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ subscription: sub.toJSON(), teams: [team], prefs }) })
  if (!r.ok) throw new Error(`relay ${r.status}`)
  // The service worker reads the team and choices from here when a notification arrives
  await (await caches.open('shlstats-push')).put('/push-config', new Response(JSON.stringify({ teams: [team], prefs })))
  store.set('shlstats-push', JSON.stringify(prefs))
}

export async function pushOff() {
  try {
    const reg = await navigator.serviceWorker.ready, sub = await reg.pushManager.getSubscription()
    if (sub) {
      await fetch(`${LIVE_API}/push/unsubscribe`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ endpoint: sub.endpoint }) }).catch(() => {})
      await sub.unsubscribe()
    }
  } catch { /* nothing to undo */ }
  store.set('shlstats-push', '')
}
