import { isThemeName, themeNames, themes, type ThemeName } from './themes'

// One theme for the whole site: the terminal's `theme` command and the
// standard site's picker read and write the same value.
export type SiteTheme = ThemeName

const KEY = 'portfolio.theme'
export const THEME_EVENT = 'portfolio-theme'

export const siteThemes = themeNames.map((name) => ({ id: name, label: themes[name]!.label, theme: themes[name]! }))

export const isSiteTheme = isThemeName
export const terminalTheme = (theme: SiteTheme): ThemeName => theme

export function readTheme(): SiteTheme {
  try { const saved = localStorage.getItem(KEY); if (saved && isSiteTheme(saved)) return saved } catch { /* storage unavailable */ }
  const light = typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: light)').matches
  return light ? (isThemeName('paper') ? 'paper' : themeNames.find((name) => themes[name]!.scheme === 'light') ?? themeNames[0]!) : (isThemeName('phosphor') ? 'phosphor' : themeNames[0]!)
}

export function saveTheme(theme: SiteTheme) {
  try { localStorage.setItem(KEY, theme) } catch { /* storage unavailable */ }
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(THEME_EVENT, { detail: theme }))
}

// Follows changes from this page (custom event) and other tabs (storage event).
export function onThemeChange(listener: (theme: SiteTheme) => void): () => void {
  const local = (event: Event) => { const value = (event as CustomEvent<string>).detail; if (isSiteTheme(value)) listener(value) }
  const remote = (event: StorageEvent) => { if (event.key === KEY && event.newValue && isSiteTheme(event.newValue)) listener(event.newValue) }
  window.addEventListener(THEME_EVENT, local)
  window.addEventListener('storage', remote)
  return () => { window.removeEventListener(THEME_EVENT, local); window.removeEventListener('storage', remote) }
}
