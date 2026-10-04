import catalog from '../data/tech-icons.json'
import './TechIcon.css'

// Logos for skills, matched by name: an exact name or alias from
// src/data/tech-icons.json, else the simple-icons slug rules. Adding an icon is
// an SVG in public/icons/tech/ plus an entry there; unknown names get a letter.
type Entry = { title: string; color: string | null; names: string[] }
const icons = (catalog as { icons: Record<string, Entry> }).icons
const byName = new Map(Object.entries(icons).flatMap(([slug, entry]) => entry.names.map((name) => [name, slug] as const)))
const slugify = (name: string) => name.toLowerCase().replace(/\+/g, 'plus').replace(/#/g, 'sharp').replace(/\./g, 'dot').replace(/[^a-z0-9]/g, '')

export function techIcon(name: string): { slug: string; title: string; color: string | null } | null {
  const key = name.trim().toLowerCase()
  const slug = byName.get(key) ?? (icons[slugify(key)] ? slugify(key) : undefined)
  return slug ? { slug, title: icons[slug]!.title, color: icons[slug]!.color } : null
}

export function TechIcon({ name }: { name: string }) {
  const icon = techIcon(name)
  if (!icon) return <span className="tech-icon tech-icon-fallback" aria-hidden="true">{name.trim()[0]?.toUpperCase()}</span>
  return <span className="tech-icon" aria-hidden="true" title={icon.title} style={{ '--tech-icon': `url(/icons/tech/${icon.slug}.svg)`, '--tech-color': icon.color ?? 'currentColor' } as React.CSSProperties} />
}
