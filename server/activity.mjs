// The public repository the owner most recently contributed to, from GitHub's
// public events feed (pushes, pull requests, reviews, issues). Cached briefly
// to stay well inside the unauthenticated rate limit.
import { profile } from './about.mjs'

const owner = process.env.GITHUB_OWNER ?? profile.githubUser
const REFRESH_MS = 30 * 60 * 1000
const kinds = { PushEvent: 'pushed to', PullRequestEvent: 'opened a pull request on', PullRequestReviewEvent: 'reviewed a pull request on', IssuesEvent: 'opened an issue on', CreateEvent: 'created' }
let cache = { value: null, fetchedAt: 0 }
let inflight = null

export function latestContribution(events) {
  const event = (Array.isArray(events) ? events : []).find((item) => kinds[item?.type] && item.public !== false && item.repo?.name)
  if (!event) return null
  const repo = event.repo.name
  return { repo, url: `https://github.com/${repo}`, action: kinds[event.type], at: event.created_at }
}

async function refresh() {
  const headers = { Accept: 'application/vnd.github+json', 'User-Agent': profile.host || 'terminal-portfolio' }
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`
  const response = await fetch(`https://api.github.com/users/${owner}/events/public?per_page=50`, { headers, signal: AbortSignal.timeout(8000) })
  if (!response.ok) throw new Error(`GitHub returned ${response.status}`)
  const value = latestContribution(await response.json())
  cache = { value, fetchedAt: Date.now() }
  return value
}

export async function getActivity() {
  if (cache.fetchedAt && Date.now() - cache.fetchedAt < REFRESH_MS) return cache.value
  inflight ??= refresh().finally(() => { inflight = null })
  if (cache.fetchedAt) { inflight.catch((error) => console.error(`activity refresh failed: ${error.message}`)); return cache.value }
  return inflight
}
