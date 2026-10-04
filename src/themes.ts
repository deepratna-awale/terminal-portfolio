// Themes are JSON files in themes/ at the repository root, discovered at build
// time. Each one styles both the terminal and the standard site. A shadcn or
// tweakcn registry export (cssVars with light/dark) works as-is: its dark
// palette becomes <file> and its light palette <file>-light.

export type ThemeName = string
export type Scheme = 'dark' | 'light'
export type ThemeColors = {
  background: string; surface: string; foreground: string; muted: string; accent: string
  accentForeground?: string; accent2?: string; link?: string; command?: string; success?: string; error?: string
}
type NativeTheme = { name: string; scheme: Scheme; colors: ThemeColors; terminal?: { background?: string; chrome?: string; code?: string; border?: string; glow?: string } }
type ShadcnTheme = { name?: string; cssVars: { light?: Record<string, string>; dark?: Record<string, string> } }
export type ThemeFile = NativeTheme | ShadcnTheme
export type Theme = { id: ThemeName; label: string; scheme: Scheme; colors: ThemeColors; vars: Record<string, string>; site: Record<string, string> }

const mix = (color: string, percent: number, other = 'transparent') => `color-mix(in srgb, ${color} ${percent}%, ${other})`
// Old shadcn files store bare HSL triples ("222 47% 11%").
const css = (value: string | undefined) => (value && /^-?[\d.]+(deg)?\s+[\d.]+%\s+[\d.]+%/.test(value.trim()) ? `hsl(${value.trim()})` : value?.trim())

export function fromShadcn(vars: Record<string, string>): ThemeColors {
  const v = (key: string) => css(vars[key])
  return {
    background: v('background')!, foreground: v('foreground')!, accent: v('primary')!,
    surface: v('card') ?? v('secondary') ?? v('muted') ?? v('background')!,
    muted: v('muted-foreground') ?? mix(v('foreground')!, 60, v('background')),
    accentForeground: v('primary-foreground'), accent2: v('chart-2') ?? v('accent'), link: v('chart-1') ?? v('ring'),
    command: v('chart-3'), success: v('chart-2'), error: v('destructive'),
  }
}

export function buildTheme(id: string, label: string, scheme: Scheme, colors: ThemeColors, terminal: NativeTheme['terminal'] = {}): Theme {
  const { background: bg, surface, foreground: fg, muted, accent } = colors
  const accent2 = colors.accent2 ?? mix(accent, 60, fg)
  return {
    id, label, scheme, colors,
    vars: {
      '--fg': fg, '--muted': muted, '--accent': accent, '--accent-2': accent2, '--link': colors.link ?? accent2,
      '--error': colors.error ?? '#ef4444', '--success': colors.success ?? accent2, '--command': colors.command ?? accent,
      '--code-bg': terminal.code ?? mix(accent, 10), '--term-bg': terminal.background ?? mix(bg, 88), '--chrome-bg': terminal.chrome ?? mix(surface, 92),
      '--border': terminal.border ?? mix(accent, 28), '--glow': terminal.glow ?? 'none', '--term-solid': bg,
    },
    site: {
      '--bg': bg, '--bg-2': mix(bg, 96, fg), '--surface': surface, '--surface-2': mix(surface, 94, fg),
      '--border': mix(fg, 10), '--border-2': mix(fg, 18), '--text': fg, '--text-2': mix(fg, 80, bg), '--muted': muted,
      '--accent': accent, '--accent-ink': colors.accentForeground ?? bg, '--accent-soft': mix(accent, 13), '--accent-2': accent2,
      '--nav-bg': mix(bg, 78), '--heat-0': mix(fg, 7), '--heat-1': mix(accent, 30, bg), '--heat-2': mix(accent, 55, bg), '--heat-3': mix(accent, 78, bg), '--heat-4': accent,
      'colorScheme': scheme,
    },
  }
}

const title = (id: string) => id.split(/[-_]/).map((word) => word[0]!.toUpperCase() + word.slice(1)).join(' ')

export function loadThemes(files: Record<string, ThemeFile>): Record<ThemeName, Theme> {
  const result: Record<ThemeName, Theme> = {}
  for (const [path, file] of Object.entries(files).sort(([a], [b]) => a.localeCompare(b))) {
    const id = path.split('/').at(-1)!.replace(/\.json$/, '')
    if (id === 'theme.schema') continue
    if ('cssVars' in file) {
      const label = file.name ?? title(id)
      if (file.cssVars.dark) result[id] = buildTheme(id, label, 'dark', fromShadcn({ ...file.cssVars.light, ...file.cssVars.dark }))
      if (file.cssVars.light) result[file.cssVars.dark ? `${id}-light` : id] = buildTheme(file.cssVars.dark ? `${id}-light` : id, file.cssVars.dark ? `${label} Light` : label, 'light', fromShadcn(file.cssVars.light))
    } else result[id] = buildTheme(id, file.name, file.scheme, file.colors, file.terminal)
  }
  return result
}

export const themes = loadThemes(import.meta.glob<ThemeFile>('../themes/*.json', { eager: true, import: 'default' }))
export const themeNames = Object.keys(themes)
export const isThemeName = (value: string): value is ThemeName => Object.hasOwn(themes, value)
