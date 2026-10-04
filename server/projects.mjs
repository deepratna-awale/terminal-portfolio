// Public GitHub repositories, summarised into bullets by Bedrock. Summaries are
// kept for a month in the guestbook bucket, so pushes and redeploys don't spend
// model calls. READMEs come from raw.githubusercontent.com, which does not count
// against the 60 requests/hour unauthenticated REST limit.
import { featured, featuredBullets, profile } from './about.mjs'
import { bedrockConfigured, converse } from './bedrock.mjs'
import { s3Object } from './s3.mjs'

const owner = process.env.GITHUB_OWNER ?? profile.githubUser
// Only the repositories listed under `featured` in ABOUT.md appear, in that
// order. Each has a share image at public/media/projects/<name>.jpg.
const rank = new Map(featured.map((name, index) => [name.toLowerCase(), index]))
const REFRESH_MS = 6 * 60 * 60 * 1000
const SUMMARY_MS = 30 * 24 * 60 * 60 * 1000 // a summary is regenerated at most once a month
const RETRY_MS = 24 * 60 * 60 * 1000 // a failed summary is retried the next day

let cache = { projects: null, fetchedAt: 0 }
let inflight = null
const summaries = new Map() // lowercase name -> { at, bullets, failed? }

// Without the bucket (development) summaries only live in memory.
function summaryStore() {
  const { GUESTBOOK_BUCKET: bucket, GUESTBOOK_ACCESS_KEY_ID: accessKeyId, GUESTBOOK_SECRET_ACCESS_KEY: secretAccessKey } = process.env
  if (!bucket || !accessKeyId || !secretAccessKey) return null
  return s3Object({ bucket, key: 'project-summaries.json', region: process.env.GUESTBOOK_REGION ?? 'us-east-1', accessKeyId, secretAccessKey })
}

const store = summaryStore()
let loaded = false
let summariesChanged = false

async function loadSummaries() {
  if (loaded || !store) return
  try {
    const saved = JSON.parse((await store.get()) ?? '{}')
    for (const [name, entry] of Object.entries(saved)) if (Array.isArray(entry?.bullets) && typeof entry.at === 'number') summaries.set(name, entry)
    loaded = true
  } catch (error) {
    console.error(`could not load project summaries: ${error.message}`)
  }
}

async function saveSummaries() {
  if (!store) return
  await store.put(JSON.stringify(Object.fromEntries(summaries))).catch((error) => console.error(`could not save project summaries: ${error.message}`))
}

function githubHeaders() {
  const headers = { Accept: 'application/vnd.github+json', 'User-Agent': profile.host }
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`
  return headers
}

async function readme(repo) {
  for (const file of ['README.md', 'readme.md', 'README.MD', 'README']) {
    const response = await fetch(`https://raw.githubusercontent.com/${owner}/${repo.name}/${repo.default_branch}/${file}`, { signal: AbortSignal.timeout(8000) }).catch(() => null)
    if (response?.ok) return (await response.text()).slice(0, 6000)
  }
  return ''
}

function fallbackBullets(repo) {
  const sentences = (repo.description ?? '').split(/(?<=[.!?])\s+/).map((sentence) => sentence.trim()).filter(Boolean)
  return sentences.slice(0, 3)
}

async function summarise(repo) {
  const written = featuredBullets.get(repo.name.toLowerCase())
  if (written?.length) return written
  const key = repo.name.toLowerCase()
  const known = summaries.get(key)
  if (known && Date.now() - known.at < (known.failed ? RETRY_MS : SUMMARY_MS)) return known.failed ? fallbackBullets(repo) : known.bullets
  if (!bedrockConfigured()) return fallbackBullets(repo)
  summariesChanged = true
  try {
    const { text, blocked } = await converse({
      system: 'You write terse portfolio bullets for software projects. Reply with only a JSON array of 2 or 3 strings. Each string is one plain-English bullet under 20 words describing what the project does or how it works. No markdown, no emojis, no marketing fluff. Use only facts from the input.',
      messages: [{ role: 'user', content: `Repository: ${repo.name}\nLanguage: ${repo.language ?? 'unknown'}\nDescription: ${repo.description ?? '(none)'}\n\nREADME:\n${await readme(repo)}` }],
      maxTokens: 220,
      temperature: 0.2,
    })
    if (blocked) throw new Error('blocked by guardrail')
    const bullets = JSON.parse(text.slice(text.indexOf('['), text.lastIndexOf(']') + 1))
    if (!Array.isArray(bullets) || !bullets.every((bullet) => typeof bullet === 'string')) throw new Error('bad shape')
    const clean = bullets.map((bullet) => bullet.trim()).filter(Boolean).slice(0, 3)
    summaries.set(key, { at: Date.now(), bullets: clean })
    return clean
  } catch (error) {
    console.error(`summary failed for ${repo.name}: ${error.message}`)
    summaries.set(key, { at: Date.now(), bullets: [], failed: true })
    return fallbackBullets(repo)
  }
}

async function mapLimit(items, limit, task) {
  const results = new Array(items.length)
  let next = 0
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) { const index = next++; results[index] = await task(items[index]) }
  }))
  return results
}

async function refresh() {
  const response = await fetch(`https://api.github.com/users/${owner}/repos?per_page=100&sort=pushed`, { headers: githubHeaders(), signal: AbortSignal.timeout(10_000) })
  if (!response.ok) throw new Error(`GitHub returned ${response.status}`)
  const repos = (await response.json())
    .filter((repo) => !repo.private && rank.has(repo.name.toLowerCase()))
    .sort((a, b) => rank.get(a.name.toLowerCase()) - rank.get(b.name.toLowerCase()))
  await loadSummaries()
  summariesChanged = false
  const bullets = await mapLimit(repos, 3, summarise)
  if (summariesChanged) await saveSummaries()
  cache = {
    fetchedAt: Date.now(),
    projects: repos.map((repo, index) => ({
      name: repo.name,
      description: repo.description ?? '',
      language: repo.language,
      stars: repo.stargazers_count,
      url: repo.html_url,
      homepage: repo.homepage || null,
      image: `/media/projects/${featured[rank.get(repo.name.toLowerCase())]}.jpg`,
      pushedAt: repo.pushed_at,
      bullets: bullets[index],
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
