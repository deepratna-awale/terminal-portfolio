// Parses ABOUT.md, the single source of the site's content. Shared by the
// client (src/content.ts), the server (assistant context, featured projects)
// and the build (page metadata, favicon, sitemap). See README, "Make it yours".
//
// Format: a small YAML-like frontmatter block between --- lines, then one
// `# Heading` per section. A heading may be followed by an HTML comment with
// options, e.g. <!-- command: education | nav: Education | help: degrees -->.

const RESERVED = new Set(['assistant'])

export const slugify = (text) => text.toLowerCase().replace(/&/g, ' ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

const unquote = (value) => {
  const text = value.trim()
  return /^(["']).*\1$/.test(text) ? text.slice(1, -1) : text
}

function scalar(value) {
  const text = value.trim()
  if (text.startsWith('[') && text.endsWith(']')) return text.slice(1, -1).split(',').map(unquote).filter(Boolean)
  return unquote(text)
}

const indentOf = (line) => /^ */.exec(line)[0].length

// key: value, key: [a, b], key: | (indented block), key: followed by an
// indented list (- item) or map (sub: value). Lines starting with # are comments.
export function parseFrontmatter(text) {
  const lines = text.split('\n')
  const data = {}
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]
    if (!line.trim() || line.trimStart().startsWith('#') || indentOf(line) > 0) continue
    const match = /^([\w-]+):\s*(.*)$/.exec(line)
    if (!match) throw new Error(`ABOUT.md frontmatter: cannot read line ${index + 2}: ${line}`)
    const [, key, rest] = match
    const block = []
    while (index + 1 < lines.length && (lines[index + 1].trim() === '' || indentOf(lines[index + 1]) > 0)) block.push(lines[++index])
    while (block.length && !block.at(-1).trim()) block.pop()
    if (rest === '|' || rest === '|-') {
      const indent = Math.min(...block.filter((item) => item.trim()).map(indentOf))
      data[key] = block.map((item) => item.slice(indent)).join('\n')
    } else if (rest.trim()) {
      data[key] = scalar(rest)
    } else if (block.every((item) => !item.trim() || item.trim().startsWith('- '))) {
      data[key] = block.filter((item) => item.trim()).map((item) => scalar(item.trim().slice(2)))
    } else {
      data[key] = Object.fromEntries(block.filter((item) => item.trim() && !item.trim().startsWith('#')).map((item) => {
        const pair = /^\s*([^:]+?):\s+(.*)$/.exec(item)
        if (!pair) throw new Error(`ABOUT.md frontmatter: cannot read "${item.trim()}" under ${key}`)
        return [unquote(pair[1]), scalar(pair[2])]
      }))
    }
  }
  return data
}

function options(line) {
  const match = /^<!--\s*(.*?)\s*-->$/.exec(line?.trim() ?? '')
  if (!match) return null
  return Object.fromEntries(match[1].split('|').map((part) => part.split(':')).filter((pair) => pair.length >= 2).map(([key, ...value]) => [key.trim(), value.join(':').trim()]))
}

const trimBlank = (lines) => {
  const copy = [...lines]
  while (copy.length && !copy[0].trim()) copy.shift()
  while (copy.length && !copy.at(-1).trim()) copy.pop()
  return copy
}

export function parseAboutMarkdown(source) {
  const text = source.replace(/\r\n/g, '\n')
  const front = /^---\n([\s\S]*?)\n---\n?/.exec(text)
  const meta = front ? parseFrontmatter(front[1]) : {}
  const body = front ? text.slice(front[0].length) : text

  const sections = []
  let fenced = false
  for (const line of body.split('\n')) {
    if (/^(```|~~~)/.test(line)) fenced = !fenced
    const heading = !fenced && /^# (.+?)\s*#*$/.exec(line)
    if (heading) sections.push({ title: heading[1].trim(), lines: [] })
    else sections.at(-1)?.lines.push(line)
  }

  const visible = []
  let assistant = ''
  for (const section of sections) {
    const opts = options(section.lines.find((line) => line.trim())) ?? {}
    const lines = trimBlank(Object.keys(opts).length ? section.lines.slice(section.lines.findIndex((line) => line.trim()) + 1) : section.lines)
    const id = slugify(opts.command || section.title)
    if (!id) continue
    if (RESERVED.has(id)) { assistant = lines.join('\n').replace(/<!--[\s\S]*?-->/g, '').trim(); continue }
    visible.push({ id, title: section.title, nav: opts.nav || section.title, help: opts.help || `the ${section.title.toLowerCase()} section`, lines })
  }
  return { meta, sections: visible, assistant }
}

// Values every consumer needs, with the derived ones filled in.
export function siteProfile(meta) {
  const required = ['name', 'domain', 'email', 'github']
  const missing = required.filter((key) => !meta[key])
  if (missing.length) throw new Error(`ABOUT.md frontmatter is missing: ${missing.join(', ')}`)
  const name = String(meta.name)
  return {
    name,
    shortName: String(meta.short_name || name.split(/\s+/)[0]),
    handle: String(meta.handle || slugify(name.split(/\s+/)[0])),
    initials: String(meta.initials || name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase()),
    host: String(meta.domain),
    website: `https://${meta.domain}`,
    title: String(meta.title ?? ''),
    tagline: String(meta.tagline ?? ''),
    location: String(meta.location ?? ''),
    email: String(meta.email),
    githubUser: String(meta.github),
    github: `https://github.com/${meta.github}`,
    linkedin: meta.linkedin ? `https://www.linkedin.com/in/${meta.linkedin}` : '',
    source: String(meta.source || `https://github.com/${meta.github}/terminal-portfolio`),
    resume: String(meta.resume ?? ''),
  }
}

// Plain-text facts for the assistant: every visible section plus the
// Assistant section's own notes.
export function assistantFacts({ meta, sections, assistant }) {
  const plain = (line) => line.replace(/\[([^\]]+)\]\(cmd:[^)]*\)/g, '$1').replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)').replace(/\*\*([^*]+)\*\*/g, '$1').replace(/`([^`]+)`/g, '$1')
  const profile = siteProfile(meta)
  const header = [`${profile.name}${profile.title ? `, ${profile.title}` : ''}${profile.location ? `, based in ${profile.location}` : ''}.`]
  const body = sections.filter((section) => !['projects', 'guestbook'].includes(section.id) && section.lines.length).map((section) => `# ${section.title}\n${section.lines.map(plain).join('\n')}`)
  return [...header, '', ...body, '', assistant].join('\n').replace(/\n{3,}/g, '\n\n').trim()
}
