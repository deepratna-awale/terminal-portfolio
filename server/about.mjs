// ABOUT.md, read once at startup: the same source the client renders.
import { readFileSync } from 'node:fs'
import { assistantFacts, parseAboutMarkdown, siteProfile } from '../shared/about.js'

export const about = parseAboutMarkdown(readFileSync(new URL('../ABOUT.md', import.meta.url), 'utf8'))
export const profile = siteProfile(about.meta)
export const featured = Array.isArray(about.meta.featured) ? about.meta.featured.map(String) : []

// The Assistant section's "## Rules" list adds to the built-in rules; everything else is facts.
const rulesMatch = /^## Rules\s*\n([\s\S]*?)(?=^## |(?![\s\S]))/m.exec(about.assistant)
export const assistantRules = (rulesMatch?.[1] ?? '').split('\n').filter((line) => line.startsWith('- ')).join('\n')
export const knowledge = assistantFacts({ ...about, assistant: about.assistant.replace(rulesMatch?.[0] ?? '', '').replace(/^## .*$/gm, '').trim() })
