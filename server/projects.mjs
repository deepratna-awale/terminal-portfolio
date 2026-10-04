// Public GitHub repositories, summarised into bullets by Bedrock and cached in
// memory. READMEs come from raw.githubusercontent.com, which does not count
// against the 60 requests/hour unauthenticated REST limit.
import { bedrockConfigured, converse } from './bedrock.mjs'

const owner = process.env.GITHUB_OWNER ?? 'deepratna-awale'
// Only these repositories appear on the site, in this order. Each has a share
// image at public/media/projects/<name>.jpg (the repo's GitHub social preview).
const featured = ['open-wallpaper-engine-mac', 'AutoExpress', '3t-chatbot', 'sd-parsers', 'TAES2', 'Polar-Image-Inspector']
const rank = new Map(featured.map((name, index) => [name.toLowerCase(), index]))
const REFRESH_MS = 6 * 60 * 60 * 1000

let cache = { projects: null, fetchedAt: 0 }
let inflight = null
const summaries = new Map() // name -> { pushedAt, bullets }

function githubHeaders() {
  const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'deepratna-awale.dev' }
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
  const known = summaries.get(repo.name)
  if (known && known.pushedAt === repo.pushed_at) return known.bullets
  if (!bedrockConfigured()) return fallbackBullets(repo)
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
    summaries.set(repo.name, { pushedAt: repo.pushed_at, bullets: clean })
    return clean
  } catch (error) {
    console.error(`summary failed for ${repo.name}: ${error.message}`)
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
  const bullets = await mapLimit(repos, 3, summarise)
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
