// Repositories listed under `featured` in ABOUT.md, with the bullets written
// for them there. No model calls: the list is cached for 6 hours.
import { featured, featuredNotes, profile } from './about.mjs'

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
  const written = featuredNotes.get(repo.name.toLowerCase())?.bullets
  return written?.length ? written : fallbackBullets(repo)
}

async function refresh() {
  const response = await fetch(`https://api.github.com/users/${owner}/repos?per_page=100&sort=pushed`, { headers: githubHeaders(), signal: AbortSignal.timeout(10_000) })
  if (!response.ok) throw new Error(`GitHub returned ${response.status}`)
  const repos = (await response.json()).filter((repo) => !repo.private && rank.has(repo.name.toLowerCase()))
  const listed = new Map(repos.map((repo) => [repo.name.toLowerCase(), repo]))
  cache = {
    fetchedAt: Date.now(),
    projects: featured.map((name) => {
      const repo = listed.get(name.toLowerCase())
      const note = featuredNotes.get(name.toLowerCase())
      const image = `/media/projects/${name}.jpg`
      if (repo) return { name: repo.name, title: note?.title ?? null, description: repo.description ?? '', language: repo.language, stars: repo.stargazers_count, url: repo.html_url, homepage: repo.homepage || note?.live || null, image, pushedAt: repo.pushed_at, bullets: bulletsFor(repo) }
      // A private repository: shown from its ABOUT.md notes, linking to the live site instead of the code.
      if (note?.live) return { name, title: note.title, description: '', language: note.language, stars: 0, url: note.live, homepage: note.live, image, pushedAt: '', bullets: note.bullets, private: true }
      return null
    }).filter(Boolean),
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
  return (cache.projects ?? []).map((project) => `- ${project.title ? `${project.title} (${project.name})` : project.name} (${project.language ?? 'n/a'}, ${project.private ? `private code, live at ${project.homepage}` : `${project.stars} stars`}): ${project.bullets.join(' ') || project.description}`).join('\n')
}
