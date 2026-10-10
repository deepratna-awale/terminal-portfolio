import { describe, expect, it } from 'vitest'
import { assistantFacts, parseAboutMarkdown, parseFrontmatter, projectBullets, projectNotes, siteProfile } from '../../shared/about.js'
import { links, linksFor, sectionList } from '../content'
import { commands, directories } from './commands'
import { complete } from './completion'

const fixture = `---
name: Ada Lovelace
email: ada@example.dev
domain: example.dev
github: ada
media:
  diagram.svg: The engine: a diagram
featured: [engine, notes]
motd:
  - First line
ascii_logo: |
  ADA
   LOVELACE
---

# About
Hello.

# Talks & Workshops
<!-- help: conference talks -->

\`\`\`
# not a heading
\`\`\`

# Assistant
<!-- hidden -->
## Rules
- Be kind.
`

describe('ABOUT.md parsing', () => {
  it('reads the frontmatter subset', () => {
    const meta = parseFrontmatter('a: 1\nlist:\n  - x\n  - "y"\nmap:\n  k: v: w\ninline: [p, q]\nblock: |\n  one\n    two\n')
    expect(meta).toEqual({ a: '1', list: ['x', 'y'], map: { k: 'v: w' }, inline: ['p', 'q'], block: 'one\n  two' })
    expect(parseFrontmatter('links:\n  # dock\n  - id: gh\n    color: "#fff"\n    show: [dock, newtab]\n  - name: Mail\n    url: mailto:a@b.c\n')).toEqual({ links: [{ id: 'gh', color: '#fff', show: ['dock', 'newtab'] }, { name: 'Mail', url: 'mailto:a@b.c' }] })
  })

  it('turns each heading into a section and keeps the assistant notes private', () => {
    const about = parseAboutMarkdown(fixture)
    expect(about.sections.map((section) => [section.id, section.title, section.help])).toEqual([
      ['about', 'About', 'the about section'],
      ['talks-workshops', 'Talks & Workshops', 'conference talks'],
    ])
    expect(about.sections[1]!.lines.join('\n')).toContain('# not a heading')
    expect(about.assistant).toBe('## Rules\n- Be kind.')
    expect(about.meta.media).toEqual({ 'diagram.svg': 'The engine: a diagram' })
    expect(about.meta.ascii_logo).toBe('ADA\n LOVELACE')
    expect(siteProfile(about.meta)).toMatchObject({ initials: 'AL', handle: 'ada', shortName: 'Ada', website: 'https://example.dev', github: 'https://github.com/ada', linkedin: '' })
    expect(assistantFacts(about)).toContain('# About\nHello.')
  })

  it('requires the core profile fields', () => {
    expect(() => siteProfile({ name: 'Ada' })).toThrow(/missing: domain, email, github/)
  })
})

describe('sections from ABOUT.md', () => {
  it('gives every section a command, and every static one a directory', () => {
    for (const section of sectionList) expect(commands[section.id]?.summary).toBe(section.help)
    expect(directories).toEqual([...sectionList.map((section) => section.id).filter((id) => id !== 'now' && id !== 'guestbook'), 'media'])
    expect(complete('cd ed', '~', [], []).candidates).toEqual(['education/'])
  })
})

describe('links from ABOUT.md', () => {
  it('places each link where it asks to be and makes ids open targets', () => {
    expect(linksFor('dock').map((link) => link.name)).toEqual(links.filter((link) => link.show.includes('dock')).map((link) => link.name))
    for (const link of links.filter((item) => item.image)) expect(link.icon).toMatch(/^(\/|https?:)/)
    const targets = complete('open ', '~', [], []).candidates
    for (const link of links.filter((item) => item.id)) expect(targets).toContain(link.id.toLowerCase())
  })

  it('reads hand-written project bullets from ## headings under Projects', () => {
    const { sections } = parseAboutMarkdown('# Projects\nPulled live.\n\n## My-Repo\n- First, with a comma.\n- Second.\n\n# Skills\n## Not-A-Repo\n- ignored\n')
    const bullets = projectBullets(sections)
    expect([...bullets.keys()]).toEqual(['my-repo'])
    expect(bullets.get('my-repo')).toEqual(['First, with a comma.', 'Second.'])
  })

  it('reads an optional title, live link and language line under a project heading', () => {
    const { sections } = parseAboutMarkdown('# Projects\n## private-repo\n<!-- title: Shiny | live: https://shiny.example | language: Python -->\n- Does a thing.\n\n## plain\n- Only bullets.\n')
    const notes = projectNotes(sections)
    expect(notes.get('private-repo')).toEqual({ bullets: ['Does a thing.'], title: 'Shiny', live: 'https://shiny.example', language: 'Python' })
    expect(notes.get('plain')).toEqual({ bullets: ['Only bullets.'], title: null, live: null, language: null })
  })
})
