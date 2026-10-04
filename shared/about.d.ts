export type AboutSection = { id: string; title: string; nav: string; help: string; lines: string[] }
export type FrontmatterValue = string | string[] | Record<string, string | string[]> | Array<Record<string, string | string[]>>
export type AboutData = { meta: Record<string, FrontmatterValue>; sections: AboutSection[]; assistant: string }
export type SiteProfile = {
  name: string
  shortName: string
  handle: string
  initials: string
  host: string
  website: string
  title: string
  tagline: string
  location: string
  email: string
  githubUser: string
  github: string
  linkedin: string
  source: string
  resume: string
}

export function slugify(text: string): string
export function parseFrontmatter(text: string): Record<string, FrontmatterValue>
export function parseAboutMarkdown(source: string): AboutData
export function siteProfile(meta: Record<string, FrontmatterValue>): SiteProfile
export function assistantFacts(about: AboutData): string
export function projectBullets(sections: AboutSection[]): Map<string, string[]>
