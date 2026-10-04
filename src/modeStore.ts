// Which mode a phone visitor last chose. Phones open the standard site unless
// they picked the terminal; desktops always start in the terminal.
const KEY = 'portfolio.mode'
export type SiteMode = 'gui' | 'terminal'

export function readMode(): SiteMode | null {
  try { const value = localStorage.getItem(KEY); return value === 'gui' || value === 'terminal' ? value : null } catch { return null }
}

export function saveMode(mode: SiteMode) {
  try { localStorage.setItem(KEY, mode) } catch { /* storage unavailable */ }
}

export const isPhone = () => typeof window !== 'undefined' && window.matchMedia('(max-width: 720px)').matches

// The root URL on a phone, with no deep link, opens the site unless the visitor chose the terminal.
export function startsInGui(location: Pick<Location, 'pathname' | 'search'>): boolean {
  if (/^\/gui(\/|\.html|$)/.test(location.pathname)) return true
  return isPhone() && location.pathname === '/' && !new URLSearchParams(location.search).has('cmd') && readMode() !== 'terminal'
}
