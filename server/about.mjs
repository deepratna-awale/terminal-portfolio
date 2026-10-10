// ABOUT.md, read once at startup: the same source the client renders.
import { readFileSync } from 'node:fs'
import { assistantFacts, parseAboutMarkdown, projectNotes, siteProfile } from '../shared/about.js'

export const about = parseAboutMarkdown(readFileSync(new URL('../ABOUT.md', import.meta.url), 'utf8'))
export const profile = siteProfile(about.meta)
export const featured = Array.isArray(about.meta.featured) ? about.meta.featured.map(String) : []
// Hand-written notes (bullets, optional title and live link) for featured
// repositories, keyed by lowercase name.
export const featuredNotes = projectNotes(about.sections)
export const featuredBullets = new Map([...featuredNotes].map(([name, note]) => [name, note.bullets]))

// The Assistant section's "## Rules" list adds to the built-in rules; everything else is facts.
const rulesMatch = /^## Rules\s*\n([\s\S]*?)(?=^## |(?![\s\S]))/m.exec(about.assistant)
export const assistantRules = (rulesMatch?.[1] ?? '').split('\n').filter((line) => line.startsWith('- ')).join('\n')
export const knowledge = assistantFacts({ ...about, assistant: about.assistant.replace(rulesMatch?.[0] ?? '', '').replace(/^## .*$/gm, '').trim() })
