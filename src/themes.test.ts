import { describe, expect, it } from 'vitest'
import { loadThemes, themeNames, themes, type ThemeFile } from './themes'

// A small JSON Schema checker covering what themes/theme.schema.json uses, so
// CI validates every theme file without another dependency.
type Schema = Record<string, unknown>
const raw = import.meta.glob<unknown>('../themes/*.json', { eager: true, import: 'default' })
const root = raw['../themes/theme.schema.json'] as Schema
const files = Object.keys(raw).filter((path) => !path.endsWith('theme.schema.json'))

function validate(value: unknown, schema: Schema, path = '$'): string[] {
  if (schema.$ref) return validate(value, ((root.$defs as Record<string, Schema>)[(schema.$ref as string).split('/').at(-1)!])!, path)
  if (schema.oneOf) {
    const passing = (schema.oneOf as Schema[]).filter((option) => !validate(value, option, path).length)
    return passing.length === 1 ? [] : [`${path}: matches ${passing.length} of the allowed shapes (expected exactly 1)`]
  }
  const errors: string[] = []
  if (schema.anyOf && !(schema.anyOf as Schema[]).some((option) => !validate(value, option, path).length)) errors.push(`${path}: matches none of anyOf`)
  if (schema.enum && !(schema.enum as unknown[]).includes(value)) return [`${path}: must be one of ${(schema.enum as unknown[]).join(', ')}`]
  if (schema.type === 'string') {
    if (typeof value !== 'string') return [`${path}: must be a string`]
    if (schema.pattern && !new RegExp(schema.pattern as string).test(value)) errors.push(`${path}: "${value}" is not a valid colour`)
    if (schema.minLength !== undefined && value.length < (schema.minLength as number)) errors.push(`${path}: too short`)
    if (schema.maxLength !== undefined && value.length > (schema.maxLength as number)) errors.push(`${path}: too long`)
  }
  if (schema.type === 'object') {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return [`${path}: must be an object`]
    const object = value as Record<string, unknown>
    for (const key of (schema.required as string[] | undefined) ?? []) if (!(key in object)) errors.push(`${path}: missing "${key}"`)
    const properties = (schema.properties as Record<string, Schema> | undefined) ?? {}
    for (const [key, child] of Object.entries(object)) {
      if (properties[key]) errors.push(...validate(child, properties[key]!, `${path}.${key}`))
      else if (schema.additionalProperties === false) errors.push(`${path}: unknown key "${key}"`)
    }
  }
  return errors
}

describe('theme files', () => {
  it.each(files)('%s matches themes/theme.schema.json', (file) => {
    expect(validate(raw[file], root)).toEqual([])
  })

  it('loads every file with unique names', () => {
    expect(themeNames.length).toBe(files.length)
    const labels = themeNames.map((name) => themes[name]!.label)
    expect(new Set(labels).size).toBe(labels.length)
    for (const name of themeNames) {
      expect(themes[name]!.vars['--accent']).toBeTruthy()
      expect(themes[name]!.site['--bg']).toBeTruthy()
    }
  })

  it('accepts a shadcn / tweakcn registry export', () => {
    const tweakcn: ThemeFile = { name: 'Amethyst', cssVars: {
      light: { background: 'oklch(0.98 0 0)', foreground: 'oklch(0.2 0 0)', primary: 'oklch(0.6 0.2 300)', card: 'oklch(1 0 0)', 'muted-foreground': 'oklch(0.5 0 0)' },
      dark: { background: '222.2 84% 4.9%', foreground: '210 40% 98%', primary: 'oklch(0.7 0.2 300)' },
    } }
    expect(validate(tweakcn, root)).toEqual([])
    const loaded = loadThemes({ '/themes/amethyst.json': tweakcn })
    expect(Object.keys(loaded)).toEqual(['amethyst', 'amethyst-light'])
    expect(loaded.amethyst!.scheme).toBe('dark')
    expect(loaded.amethyst!.site['--bg']).toBe('hsl(222.2 84% 4.9%)')
    expect(loaded['amethyst-light']!.vars['--accent']).toBe('oklch(0.6 0.2 300)')
  })

  it('rejects a broken theme', () => {
    expect(validate({ name: 'Oops', scheme: 'dim', colors: { background: 'blue' } }, root).length).toBeGreaterThan(0)
  })
})
