import { useEffect, useRef, useState } from 'react'
import { Dialog, DialogContent } from '@/components/arc/dialog/dialog'
import { safeEmbed } from '@/lib/game'
import styles from './VideoDialog.module.css'

// The video player, in Arc's dialog. Any element with data-embed (and data-title) opens it, so clip cards anywhere on
// the site just carry those attributes.
export function VideoDialog() {
  const [open, setOpen] = useState(false)
  const [video, setVideo] = useState<{ url: string; title: string } | null>(null)
  const player = useRef<HTMLIFrameElement>(null)
  // Closing blanks the player at once: the dialog keeps its last content on screen while it animates out
  const onOpenChange = (next: boolean) => { if (!next) player.current?.setAttribute('src', 'about:blank'); setOpen(next) }

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const b = (e.target as Element).closest<HTMLElement>('[data-embed]')
      const url = b && safeEmbed(b.dataset.embed)
      if (!url) return
      e.preventDefault()
      setVideo({ url, title: b.dataset.title || 'Video' })
      setOpen(true)
    }
    document.addEventListener('click', onClick)
    return () => document.removeEventListener('click', onClick)
  }, [])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={styles.content} title={video?.title || 'Video'} description="Video från SHL via Staylive." closeLabel="Stäng video">
        {/* The player only exists while the dialog is open */}
        <div className={styles.frame}>
          {open && video && <iframe ref={player} title={video.title} src={video.url} allow="autoplay; fullscreen; picture-in-picture" allowFullScreen />}
        </div>
      </DialogContent>
    </Dialog>
  )
}
