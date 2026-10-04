// Site content, parsed from ABOUT.md at the repository root (the single source:
// edit that file, not this one). Projects come live from GitHub via /api/projects.
import source from '../ABOUT.md?raw'
import { parseAboutMarkdown, siteProfile, type AboutSection } from '../shared/about.js'

const about = parseAboutMarkdown(source)
const meta = about.meta
const text = (value: unknown) => (typeof value === 'string' ? value : '')
const list = (value: unknown) => (Array.isArray(value) ? value.map(String) : typeof value === 'string' && value ? [value] : [])
const map = (value: unknown): Record<string, string> => (value && typeof value === 'object' && !Array.isArray(value) ? Object.fromEntries(Object.entries(value).map(([key, item]) => [key, String(item)])) : {})

export const profile = siteProfile(meta)

// Sections in ABOUT.md order. Each `# Heading` is a terminal command, a
// directory/file and a section of the standard site.
export const sectionList: AboutSection[] = about.sections.map((section) => (section.id === 'about' ? { ...section, lines: [`# ${profile.name}`, '', ...section.lines] } : section))
export const sections: Record<string, string[]> = Object.fromEntries(sectionList.map((section) => [section.id, section.lines]))

// Sections with their own live behaviour; every other heading is static markdown.
export const liveSections = new Set(['projects', 'now', 'guestbook'])

// Shown by `now`: an `Updated: <when>` line and a bullet list. Recent GitHub pushes are added live.
const nowLines = sections.now ?? []
export const nowItems = {
  updated: nowLines.map((line) => /^Updated:\s*(.+)$/i.exec(line.trim())?.[1]).find(Boolean) ?? '',
  items: nowLines.filter((line) => line.startsWith('- ')).map((line) => line.slice(2)),
}

export const os = { name: text(meta.os) || 'PortfolioOS', version: text(meta.os_version) || '1.0 LTS' }
export const motd = list(meta.motd)
export const neofetchRows = map(meta.neofetch)
export const exampleQuestion = text(meta.example_question) || 'what are you working on?'
export const extraLinks = map(meta.links)
export const focusDirs = list(meta.focus_dirs)
export const contactCopy = { heading: text(meta.contact_heading), note: text(meta.contact_note) }

const media = map(meta.media)
export const mediaFiles: Record<string, { src: string; alt: string }> = Object.fromEntries(Object.entries(media).map(([file, alt]) => [file, { src: `/media/${file}`, alt }]))

export const asciiLogo = text(meta.ascii_logo).replace(/\n+$/, '')

// "github.com/user" style labels for links shown as text.
export const linkLabel = (url: string) => url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')
