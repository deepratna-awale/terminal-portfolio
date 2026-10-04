// Address bar logic for the in-site browser: what stays inside, what opens for real.
import { profile } from '../content'

export const HOME = `${profile.host}/gui`
export const NEWTAB = 'chrome://newtab'
export const DINO = 'chrome://dino'
export const VERSION = 'chrome://version'
export const URLS = 'chrome://chrome-urls'
export const INCOGNITO = 'chrome://incognito'
// Internal pages listed on chrome://chrome-urls, with their tab titles.
export const chromePages: Record<string, string> = { [NEWTAB]: 'New Tab', [DINO]: 'chrome://dino', [VERSION]: 'About Version', [URLS]: 'Chrome URLs', [INCOGNITO]: 'New Incognito Tab' }
export type Egg = 'roll' | 'askew' | 'coin' | 'die'
const eggs: [RegExp, Egg][] = [[/^do an? barrel roll$|^z or r twice$/, 'roll'], [/^(askew|tilt)$/, 'askew'], [/^(flip a coin|coin flip|heads or tails)$/, 'coin'], [/^(roll an? (die|dice)|roll dice)$/, 'die']]
const SITE = profile.website

export type Target =
  | { kind: 'page'; url: string }
  | { kind: 'terminal' }
  | { kind: 'external'; url: string }
  | { kind: 'mail'; url: string }
  | { kind: 'egg'; egg: Egg }

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
  if (['about:newtab', 'about:blank'].includes(lower)) return { kind: 'page', url: NEWTAB }
  if (/^(chrome|about):/.test(lower) && !/\s/.test(lower)) {
    const page = `chrome://${lower.replace(/^(chrome|about):(\/\/)?/, '').replace(/[/?#].*$/, '')}`
    if (page === 'chrome://about') return { kind: 'page', url: URLS }
    return { kind: 'page', url: page in chromePages ? page : URLS }
  }
  const egg = eggs.find(([pattern]) => pattern.test(lower.replace(/[.!?]+$/, '')))
  if (egg) return { kind: 'egg', egg: egg[1] }
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

export const pageTitle = (url: string) => chromePages[url] ?? `${profile.name} | Portfolio`
export const internal = (url: string) => url in chromePages
export const pageHash = (url: string) => (url.startsWith(HOME) ? url.slice(HOME.length + 1) : '')
