import { useState } from 'react'
import { useData } from '@/data/context'
import { initials } from '@/lib/format'
import { tColor } from '@/lib/teams'

// Player photos come in two kinds: cut-outs (transparent around the player) and photos with a studio background
// (grey, sometimes white). For the leader cards the background is removed so they all match: starting from the
// top edge and the upper sides, pixels close to the background colour are made transparent, spreading only through
// smooth areas. The lower part (the jersey) is left alone apart from thin strips at the sides, so a white jersey
// on a white background survives. Results are kept per photo.
const CLEAN = new Map<string, string>()

function cleanPortrait(img: HTMLImageElement, url: string): string {
  const W = img.naturalWidth, H = img.naturalHeight
  if (!W || !H) return url
  const k = Math.min(1, 360 / W), w = Math.round(W * k), h = Math.round(H * k)
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h
  const cx = cv.getContext('2d', { willReadFrequently: true })!
  cx.drawImage(img, 0, 0, w, h)
  const im = cx.getImageData(0, 0, w, h), d = im.data, at = (x: number, y: number) => (y * w + x) * 4
  const corner = (x0: number) => {
    let a = 0, r = 0, g = 0, b = 0, n = 0
    for (let y = 0; y < 8; y++) for (let x = x0; x < x0 + 8; x++) { const i = at(x, y); a += d[i + 3]; r += d[i]; g += d[i + 1]; b += d[i + 2]; n++ }
    return { a: a / n, r: r / n, g: g / n, b: b / n }
  }
  const tl = corner(0), tr = corner(w - 8)
  if (tl.a < 40 && tr.a < 40) return url // already a cut-out
  const seed = { r: (tl.r + tr.r) / 2, g: (tl.g + tr.g) / 2, b: (tl.b + tr.b) / 2 }
  const toSeed = (i: number) => Math.hypot(d[i] - seed.r, d[i + 1] - seed.g, d[i + 2] - seed.b)
  const step = (i: number, j: number) => Math.hypot(d[i] - d[j], d[i + 1] - d[j + 1], d[i + 2] - d[j + 2])
  // Above 60 % of the height anything close to the background goes; lower down (beside the shoulders) only pixels that
  // are almost exactly the background colour, so a white jersey on a white background is kept. The bottom tenth is left.
  const upper = Math.round(h * 0.6), maxY = Math.round(h * 0.9)
  const limit = (y: number) => (y <= upper ? 70 : 26)
  const gone = new Uint8Array(w * h), stack: number[] = []
  const seedAt = (x: number, y: number) => { const p = y * w + x; if (!gone[p] && toSeed(p * 4) < 70) { gone[p] = 1; stack.push(p) } }
  for (let x = 0; x < w; x++) seedAt(x, 0)
  for (let y = 0; y <= upper; y++) { seedAt(0, y); seedAt(w - 1, y) }
  while (stack.length) {
    const p = stack.pop()!, x = p % w, y = (p - x) / w
    for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
      if (nx < 0 || ny < 0 || nx >= w || ny >= h || ny > maxY) continue
      const q = ny * w + nx
      if (gone[q] || toSeed(q * 4) > limit(ny) || step(q * 4, p * 4) > 18) continue
      gone[q] = 1; stack.push(q)
    }
  }
  for (let p = 0; p < w * h; p++) if (gone[p]) d[p * 4 + 3] = 0
  // A softer edge: pixels next to the removed background are made half see-through
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const p = y * w + x
    if (gone[p]) continue
    if (gone[p - 1] || gone[p + 1] || gone[p - w] || gone[p + w]) d[p * 4 + 3] = Math.round(d[p * 4 + 3] * 0.45)
  }
  cx.putImageData(im, 0, 0)
  return cv.toDataURL('image/png')
}

type PortraitProps = { id?: string | null; name: string; team: string; size?: '' | 'sm' | 'lg' | 'feat' }

// Large portrait in a team-tinted frame that fades out at the bottom; the initials show when there is no photo.
// A new player starts afresh (keyed), so the old photo never lingers while the new one loads.
export function Portrait(props: PortraitProps) {
  return <PortraitImg key={`${props.id}|${props.size}`} {...props} />
}

function PortraitImg({ id, name, team, size = '' }: PortraitProps) {
  const { headshots } = useData()
  const orig = id ? headshots[id]?.[1] : undefined
  const feat = size === 'feat'
  const [src, setSrc] = useState(() => (orig && feat ? CLEAN.get(orig) || orig : orig))
  const [shown, setShown] = useState(false)
  const [broken, setBroken] = useState(false)

  const onLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    if (feat && orig && !CLEAN.has(orig)) {
      let out = orig
      try { out = cleanPortrait(e.currentTarget, orig) } catch { /* a photo the browser won't let us read: keep it */ }
      CLEAN.set(orig, out)
      if (out !== orig) { setSrc(out); return } // loads again, now cleaned
    }
    setShown(true)
  }

  return (
    <div className={`portrait ${size}`} style={{ '--tc': tColor(team) } as React.CSSProperties}>
      {src && !broken && (
        <img src={src} alt="" className={shown ? 'in' : undefined} crossOrigin={feat ? 'anonymous' : undefined}
          onLoad={onLoad} onError={() => setBroken(true)} />
      )}
      <span className="ini">{initials(name)}</span>
    </div>
  )
}
