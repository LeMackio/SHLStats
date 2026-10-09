import type { ReactNode } from 'react'

// Line icons (drawn for this site), rendered at the current text colour
const ICONS: Record<string, ReactNode> = {
  home: <><path d="M3 11.5 12 4l9 7.5" /><path d="M5.5 10v10h13V10" /></>,
  calendar: <><rect x="3.5" y="5" width="17" height="15.5" rx="2.5" /><path d="M3.5 10h17M8 3v4M16 3v4" /></>,
  table: <><rect x="3.5" y="4" width="17" height="16" rx="2.5" /><path d="M3.5 9.5h17M3.5 14.5h17M9 4v16" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4.5 20.5c1.4-3.6 4.3-5.5 7.5-5.5s6.1 1.9 7.5 5.5" /></>,
  users: <><circle cx="9" cy="8.5" r="3.5" /><path d="M2.5 20c1-3.4 3.6-5.3 6.5-5.3s5.5 1.9 6.5 5.3" /><path d="M15.5 5.2a3.4 3.4 0 0 1 0 6.6M17.5 14.9c1.9.6 3.3 2.2 4 4.6" /></>,
  shield: <path d="M12 3.2 19.5 6v6c0 4.6-3.2 7.7-7.5 8.8C7.7 19.7 4.5 16.6 4.5 12V6z" />,
  play: <path d="M8 5.5v13l10.5-6.5z" />,
  grid: <><rect x="4" y="4" width="7" height="7" rx="1.5" /><rect x="13" y="4" width="7" height="7" rx="1.5" /><rect x="4" y="13" width="7" height="7" rx="1.5" /><rect x="13" y="13" width="7" height="7" rx="1.5" /></>,
  target: <><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="4" /></>,
  swap: <path d="M4 8h14l-3.5-3.5M20 16H6l3.5 3.5" />,
  clock: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>,
  list: <path d="M9 6.5h11M9 12h11M9 17.5h11M4.5 6.5h.01M4.5 12h.01M4.5 17.5h.01" />,
  chart: <path d="M4 20v-8M10 20V5M16 20v-9M2.5 20h19" />,
  trophy: <><path d="M8 4h8v5a4 4 0 0 1-8 0z" /><path d="M8 6H5.5a2.5 2.5 0 0 0 2.6 3.6M16 6h2.5a2.5 2.5 0 0 1-2.6 3.6M12 13v3.5M8.5 20h7M10 16.5h4" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>,
}

export function Icon({ name }: { name: string }) {
  const body = ICONS[name]
  return body ? <svg className="ic" viewBox="0 0 24 24" aria-hidden="true">{body}</svg> : null
}
