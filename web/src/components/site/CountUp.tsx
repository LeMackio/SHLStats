import { useEffect, useRef, useState } from 'react'

// Stat numbers count up when they appear: from zero, or from the number that was showing before.
// Times, ranges and dashes are shown as they are. The real number is always rendered; the animation only
// draws over it while it runs, so a paused animation (background tab) can never leave a wrong number.
const NUM = /^([+<>]?)(-?\d+)(,\d+)?(\s?%?)$/
const parse = (txt: string) => {
  const m = txt.trim().match(NUM)
  return m ? { pre: m[1], val: parseFloat(m[2] + (m[3] ? '.' + m[3].slice(1) : '')), decs: m[3] ? m[3].length - 1 : 0, post: m[4] } : null
}

export function CountUp({ text, dur = 420 }: { text: string; dur?: number }) {
  const [frame, setFrame] = useState<{ for: string; txt: string } | null>(null)
  const from = useRef<number | null>(null) // the number on screen right now (even mid-count)
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const target = parse(text), start = from.current ?? 0
    from.current = target?.val ?? null
    const el = ref.current, top = el?.getBoundingClientRect().top ?? 0
    if (!target || target.val === start || top > innerHeight || top < -200 || matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const t0 = performance.now()
    let raf = 0
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / dur), e = 1 - (1 - k) ** 3, v = start + (target.val - start) * e
      from.current = v
      setFrame(k < 1 ? { for: text, txt: target.pre + v.toFixed(target.decs).replace('.', ',') + target.post } : null)
      if (k < 1) raf = requestAnimationFrame(step)
      else from.current = target.val
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [text, dur])

  return <span ref={ref}>{frame && frame.for === text ? frame.txt : text}</span>
}
