// Address bar logic for the in-site browser: what stays inside, what opens for real.
import { profile } from '../content'

export const HOME = `${profile.host}/gui`
export const NEWTAB = 'chrome://newtab'
const SITE = profile.website

export type Target =
  | { kind: 'page'; url: string }
  | { kind: 'terminal' }
  | { kind: 'external'; url: string }
  | { kind: 'mail'; url: string }

const hostOf = (origin: string) => { try { return new URL(origin).host.toLowerCase() } catch { return '' } }
const ownHosts = (origin: string) => new Set([profile.host, `www.${profile.host}`, hostOf(origin)])

function ownPath(path: string, origin: string): Target {
  const [rawPath = '', hash = ''] = path.split('#')
  const clean = rawPath.split('?')[0]!.replace(/\/+$/, '') || '/'
  if (clean === '/gui' || clean === '/gui.html') return { kind: 'page', url: hash ? `${HOME}#${hash}` : HOME }
  if (clean === '/' || clean === '/index.html') return { kind: 'terminal' }
  return { kind: 'external', url: `${origin.replace(/\/$/, '')}${path}` }
}

export function resolveAddress(input: string, origin = SITE): Target | null {
  const text = input.trim()
  if (!text) return null
  const lower = text.toLowerCase()
  if (['chrome://newtab', 'chrome://newtab/', 'about:newtab', 'about:blank'].includes(lower)) return { kind: 'page', url: NEWTAB }
  if (lower.startsWith('mailto:')) return { kind: 'mail', url: text }
  if (text.startsWith('/') && !text.startsWith('//')) return ownPath(text, origin)
  if (!/\s/.test(text)) {
    const bare = text.replace(/^https?:\/\//i, '')
    const host = bare.split(/[/?#]/)[0]!.toLowerCase()
    if (ownHosts(origin).has(host)) return ownPath(bare.slice(host.length) || '/', host === hostOf(origin) ? origin : `https://${host}`)
    if (/^https?:\/\//i.test(text)) return { kind: 'external', url: text }
    if (/^(localhost|[a-z0-9-]+(\.[a-z0-9-]+)+)(:\d+)?([/?#]\S*)?$/i.test(text)) return { kind: 'external', url: `https://${text}` }
  }
  return { kind: 'external', url: `https://www.google.com/search?q=${encodeURIComponent(text)}` }
}

export const pageTitle = (url: string) => (url === NEWTAB ? 'New Tab' : `${profile.name} | Portfolio`)
export const pageHash = (url: string) => (url.startsWith(HOME) ? url.slice(HOME.length + 1) : '')
