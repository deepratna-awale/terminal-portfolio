import { describe, expect, it } from 'vitest'
import { assistantFacts, parseAboutMarkdown, parseFrontmatter, siteProfile } from '../../shared/about.js'
import { sectionList } from '../content'
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
