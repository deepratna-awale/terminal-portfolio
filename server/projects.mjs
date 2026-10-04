// Public GitHub repositories listed under `featured` in ABOUT.md, with the
// bullets written for them there. No model calls: the list is cached for 6 hours.
import { featured, featuredBullets, profile } from './about.mjs'

const owner = process.env.GITHUB_OWNER ?? profile.githubUser
// Only the repositories listed under `featured` in ABOUT.md appear, in that
// order. Each has a share image at public/media/projects/<name>.jpg.
const rank = new Map(featured.map((name, index) => [name.toLowerCase(), index]))
const REFRESH_MS = 6 * 60 * 60 * 1000

let cache = { projects: null, fetchedAt: 0 }
let inflight = null

function githubHeaders() {
  const headers = { Accept: 'application/vnd.github+json', 'User-Agent': profile.host }
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`
  return headers
}

function fallbackBullets(repo) {
  const sentences = (repo.description ?? '').split(/(?<=[.!?])\s+/).map((sentence) => sentence.trim()).filter(Boolean)
  return sentences.slice(0, 3)
}

// Bullets are written by hand in ABOUT.md; without them, the description.
function bulletsFor(repo) {
  const written = featuredBullets.get(repo.name.toLowerCase())
  return written?.length ? written : fallbackBullets(repo)
}

async function refresh() {
  const response = await fetch(`https://api.github.com/users/${owner}/repos?per_page=100&sort=pushed`, { headers: githubHeaders(), signal: AbortSignal.timeout(10_000) })
  if (!response.ok) throw new Error(`GitHub returned ${response.status}`)
  const repos = (await response.json())
    .filter((repo) => !repo.private && rank.has(repo.name.toLowerCase()))
    .sort((a, b) => rank.get(a.name.toLowerCase()) - rank.get(b.name.toLowerCase()))
  cache = {
    fetchedAt: Date.now(),
    projects: repos.map((repo) => ({
      name: repo.name,
      description: repo.description ?? '',
      language: repo.language,
      stars: repo.stargazers_count,
      url: repo.html_url,
      homepage: repo.homepage || null,
      image: `/media/projects/${featured[rank.get(repo.name.toLowerCase())]}.jpg`,
      pushedAt: repo.pushed_at,
      bullets: bulletsFor(repo),
    })),
  }
  return cache.projects
}

export async function getProjects() {
  const stale = Date.now() - cache.fetchedAt > REFRESH_MS
  if (cache.projects && !stale) return cache.projects
  inflight ??= refresh().finally(() => { inflight = null })
  if (cache.projects) { inflight.catch((error) => console.error(`project refresh failed: ${error.message}`)); return cache.projects }
  return inflight
}

export function projectDigest() {
  return (cache.projects ?? []).map((project) => `- ${project.name} (${project.language ?? 'n/a'}, ${project.stars} stars): ${project.bullets.join(' ') || project.description}`).join('\n')
}
