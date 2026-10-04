// GitHub's public contribution calendar, scraped from the same HTML fragment
// the profile page loads. No token needed; cached for a few hours.

const owner = process.env.GITHUB_OWNER ?? 'deepratna-awale'
const REFRESH_MS = 3 * 60 * 60 * 1000
let cache = { value: null, fetchedAt: 0 }
let inflight = null

export function parseContributions(html) {
  const counts = new Map()
  for (const match of html.matchAll(/<tool-tip[^>]*for="([^"]+)"[^>]*>([^<]*)<\/tool-tip>/g)) {
    const count = /^(\d[\d,]*) contribution/.exec(match[2].trim())
    counts.set(match[1], count ? Number(count[1].replace(/,/g, '')) : 0)
  }
  const days = []
  for (const match of html.matchAll(/<td\b[^>]*\bdata-date="(\d{4}-\d{2}-\d{2})"[^>]*>/g)) {
    const tag = match[0]
    const id = /\bid="([^"]+)"/.exec(tag)?.[1]
    const level = Number(/\bdata-level="(\d)"/.exec(tag)?.[1] ?? 0)
    days.push({ date: match[1], level, count: counts.get(id) ?? (level ? 1 : 0) })
  }
  days.sort((a, b) => a.date.localeCompare(b.date))
  const heading = /([\d,]+)\s+contributions?\s+in the last year/.exec(html)
  const total = heading ? Number(heading[1].replace(/,/g, '')) : days.reduce((sum, day) => sum + day.count, 0)
  return { total, days }
}

async function refresh() {
  const response = await fetch(`https://github.com/users/${owner}/contributions`, { headers: { 'User-Agent': 'deepratna-awale.dev', Accept: 'text/html' }, signal: AbortSignal.timeout(10_000) })
  if (!response.ok) throw new Error(`GitHub returned ${response.status}`)
  const value = parseContributions(await response.text())
  if (!value.days.length) throw new Error('GitHub changed its contribution markup')
  cache = { value, fetchedAt: Date.now() }
  return value
}

export async function getContributions() {
  if (cache.value && Date.now() - cache.fetchedAt < REFRESH_MS) return cache.value
  inflight ??= refresh().finally(() => { inflight = null })
  if (cache.value) { inflight.catch((error) => console.error(`contributions refresh failed: ${error.message}`)); return cache.value }
  return inflight
}
