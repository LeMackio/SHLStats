import { useEffect, useRef, useState } from 'react'

// Only SHL's video host is ever embedded
export const safeEmbed = (url?: string | null) => {
  try { const u = new URL(url || ''); return u.protocol === 'https:' && /(^|\.)staylive\.tv$/.test(u.hostname) ? u.href : null } catch { return null }
}

// The video player. Any element with data-embed (and data-title) opens it, so clip cards anywhere on the site
// just carry those attributes.
export function VideoDialog() {
  const dlg = useRef<HTMLDialogElement>(null)
  const [video, setVideo] = useState<{ url: string; title: string } | null>(null)

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const b = (e.target as Element).closest<HTMLElement>('[data-embed]')
      const url = b && safeEmbed(b.dataset.embed)
      if (!url) return
      e.preventDefault()
      setVideo({ url, title: b.dataset.title || 'Video' })
      dlg.current?.showModal()
    }
    document.addEventListener('click', onClick)
    return () => document.removeEventListener('click', onClick)
  }, [])

  // Every way of closing goes through here so the video always stops
  const close = () => { setVideo(null); if (dlg.current?.open) dlg.current.close() }

  return (
    <dialog className="video" ref={dlg} aria-label="Video"
      onCancel={(e) => { e.preventDefault(); close() }} onClose={() => setVideo(null)} onClick={(e) => { if (e.target === dlg.current) close() }}>
      <div className="video-head"><b>{video?.title}</b><button className="video-close" aria-label="Stäng video" onClick={close}>✕</button></div>
      <div className="video-frame">
        <iframe title="Video" src={video?.url ?? 'about:blank'} allow="autoplay; fullscreen; picture-in-picture" allowFullScreen />
      </div>
      <p className="video-note">Video från SHL via Staylive.</p>
    </dialog>
  )
}
