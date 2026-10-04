// Turns the terminal's markdown lines into ANSI text for a real terminal:
// theme colours at the depth the client supports, word wrapping, tables and
// OSC 8 hyperlinks.
import { profile } from '../src/content'
import type { ThemeColors } from '../src/themes'

export type RGB = [number, number, number]
export type ColorDepth = 'truecolor' | '256' | '16'

const clamp = (value: number) => Math.max(0, Math.min(255, Math.round(value)))
const gamma = (value: number) => (value <= 0.0031308 ? 12.92 * value : 1.055 * value ** (1 / 2.4) - 0.055)
const number = (text: string, scale = 1) => (text.trim().endsWith('%') ? (parseFloat(text) / 100) * scale : parseFloat(text))

function hsl(h: number, s: number, l: number): RGB {
  const k = (n: number) => (n + h / 30) % 12
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1))
  return [clamp(f(0) * 255), clamp(f(8) * 255), clamp(f(4) * 255)]
}

function oklch(l: number, c: number, h: number): RGB {
  const a = c * Math.cos((h * Math.PI) / 180)
  const b = c * Math.sin((h * Math.PI) / 180)
  const l3 = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m3 = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s3 = (l - 0.0894841775 * a - 1.291485548 * b) ** 3
  return [
    4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3,
    -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3,
    -0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3,
  ].map((value) => clamp(gamma(Math.max(0, Math.min(1, value))) * 255)) as RGB
}

// The CSS colour forms theme files use: hex, rgb(), hsl(), oklch() and color-mix().
export function parseColor(value: string | undefined): RGB | null {
  const text = value?.trim().toLowerCase()
  if (!text) return null
  const hex = /^#([0-9a-f]{3,8})$/.exec(text)?.[1]
  if (hex) {
    const full = hex.length <= 4 ? [...hex].map((char) => char + char).join('') : hex
    return [0, 2, 4].map((index) => parseInt(full.slice(index, index + 2), 16)) as RGB
  }
  const fn = /^([a-z-]+)\((.*)\)$/.exec(text)
  if (!fn) return null
  const [, name, body] = fn as unknown as [string, string, string]
  if (name === 'color-mix') {
    const parts = body.replace(/^in [a-z-]+,\s*/, '').split(/,(?![^(]*\))/).map((part) => part.trim())
    const read = (part = '') => { const match = /^(.*?)(?:\s+([\d.]+)%)?$/.exec(part)!; return { color: parseColor(match[1]), weight: match[2] ? Number(match[2]) / 100 : undefined } }
    const first = read(parts[0])
    const second = read(parts[1])
    if (!first.color) return second.color
    if (!second.color) return first.color
    const weight = first.weight ?? (second.weight !== undefined ? 1 - second.weight : 0.5)
    return first.color.map((channel, index) => clamp(channel * weight + second.color![index]! * (1 - weight))) as RGB
  }
  const args = body.split(/[\s,/]+/).filter(Boolean)
  if (name === 'rgb' || name === 'rgba') return [clamp(number(args[0]!, 255)), clamp(number(args[1]!, 255)), clamp(number(args[2]!, 255))]
  if (name === 'hsl' || name === 'hsla') return hsl(parseFloat(args[0]!), number(args[1]!, 1) > 1 ? number(args[1]!) / 100 : number(args[1]!, 1), number(args[2]!, 1) > 1 ? number(args[2]!) / 100 : number(args[2]!, 1))
  if (name === 'oklch') return oklch(number(args[0]!, 1), number(args[1]!, 0.4), parseFloat(args[2] ?? '0') || 0)
  return null
}

const cube = [0, 95, 135, 175, 215, 255]
const nearestCube = (value: number) => cube.reduce((best, level, index) => (Math.abs(level - value) < Math.abs(cube[best]! - value) ? index : best), 0)
export function to256([r, g, b]: RGB): number {
  const grey = Math.round(((r + g + b) / 3 - 8) / 10)
  const cubeIndex = 16 + 36 * nearestCube(r) + 6 * nearestCube(g) + nearestCube(b)
  const cubeColor = [cube[nearestCube(r)]!, cube[nearestCube(g)]!, cube[nearestCube(b)]!]
  const greyLevel = Math.max(0, Math.min(23, grey))
  const greyValue = 8 + greyLevel * 10
  const distance = (target: number[]) => (target[0]! - r) ** 2 + (target[1]! - g) ** 2 + (target[2]! - b) ** 2
  return distance([greyValue, greyValue, greyValue]) < distance(cubeColor) ? 232 + greyLevel : cubeIndex
}

const basic: RGB[] = [[0, 0, 0], [205, 49, 49], [13, 188, 121], [229, 229, 16], [36, 114, 200], [188, 63, 188], [17, 168, 205], [229, 229, 229]]
function to16([r, g, b]: RGB): number {
  let best = 0
  basic.forEach(([br, bg, bb], index) => { if ((br - r) ** 2 + (bg - g) ** 2 + (bb - b) ** 2 < (basic[best]![0] - r) ** 2 + (basic[best]![1] - g) ** 2 + (basic[best]![2] - b) ** 2) best = index })
  return best
}

export const ESC = '\x1b'
export const sgr = (codes: string) => `${ESC}[${codes}m`
export const RESET = sgr('0')

export function fg(color: RGB, depth: ColorDepth): string {
  if (depth === 'truecolor') return sgr(`38;2;${color.join(';')}`)
  if (depth === '256') return sgr(`38;5;${to256(color)}`)
  return sgr(String(90 + to16(color)))
}

export function bg(color: RGB, depth: ColorDepth): string {
  if (depth === 'truecolor') return sgr(`48;2;${color.join(';')}`)
  if (depth === '256') return sgr(`48;5;${to256(color)}`)
  return sgr(String(40 + to16(color)))
}

export type Palette = { accent: string; accent2: string; link: string; command: string; success: string; error: string; muted: string; heading: string }

export function palette(colors: ThemeColors, depth: ColorDepth): Palette {
  const pick = (value: string | undefined, fallback: RGB) => fg(parseColor(value) ?? fallback, depth)
  const accent = parseColor(colors.accent) ?? [243, 185, 94]
  return {
    accent: fg(accent, depth),
    accent2: pick(colors.accent2, accent),
    link: pick(colors.link ?? colors.accent2, accent),
    command: pick(colors.command, accent),
    success: pick(colors.success ?? colors.accent2, [142, 192, 124]),
    error: pick(colors.error, [239, 143, 130]),
    // Dim instead of the theme's muted colour, which may not suit the visitor's background.
    muted: sgr('2'),
    heading: sgr('1') + fg(accent, depth),
  }
}

// Visible width: escape sequences take no room, wide characters take two cells.
const ansiPattern = /\x1b\[[0-9;?]*[ -/]*[@-~]|\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)|\x1b[@-Z\\-_]/g
export const stripAnsi = (text: string) => text.replace(ansiPattern, '')
const wide = /[\u1100-\u115f\u2e80-\u303e\u3041-\u33ff\u3400-\u4dbf\u4e00-\u9fff\ua000-\ua4cf\uac00-\ud7a3\uf900-\ufaff\ufe30-\ufe4f\uff00-\uff60\uffe0-\uffe6]|\p{Extended_Pictographic}/u
const zero = /[\p{Mn}\u200b-\u200f]/u
export function width(text: string): number {
  let total = 0
  for (const char of stripAnsi(text)) total += zero.test(char) ? 0 : wide.test(char) ? 2 : 1
  return total
}

// Splits text into escape sequences and characters, so wrapping never cuts a sequence.
function tokens(text: string): string[] {
  const result: string[] = []
  let last = 0
  for (const match of text.matchAll(ansiPattern)) {
    result.push(...text.slice(last, match.index))
    result.push(match[0])
    last = match.index + match[0].length
  }
  result.push(...text.slice(last))
  return result
}

// Word-wraps one line of styled text. Continuation lines start with `indent`.
export function wrap(text: string, columns: number, indent = ''): string[] {
  if (columns < 8 || width(text) <= columns) return [text]
  const lines: string[] = []
  let line = ''
  let lineWidth = 0
  let word = ''
  let wordWidth = 0
  const indentWidth = width(indent)
  const flushWord = () => {
    if (!word) return
    if (lineWidth + wordWidth > columns && lineWidth > indentWidth && stripAnsi(line).trim()) {
      lines.push(line.replace(/ +$/, ''))
      line = indent
      lineWidth = indentWidth
      word = word.replace(/^ +/, '')
      wordWidth = width(word)
    }
    // A single word longer than the line is hard-split.
    while (lineWidth + wordWidth > columns) {
      let cut = ''
      let cutWidth = 0
      const parts = tokens(word)
      let index = 0
      for (; index < parts.length; index++) {
        const part = parts[index]!
        const partWidth = part.startsWith(ESC) ? 0 : width(part)
        if (lineWidth + cutWidth + partWidth > columns) break
        cut += part
        cutWidth += partWidth
      }
      if (!cutWidth) break
      lines.push(line + cut)
      line = indent
      lineWidth = indentWidth
      word = parts.slice(index).join('')
      wordWidth = width(word)
    }
    line += word
    lineWidth += wordWidth
    word = ''
    wordWidth = 0
  }
  for (const part of tokens(text)) {
    if (part === ' ' && stripAnsi(word).trim()) flushWord()
    word += part
    if (!part.startsWith(ESC)) wordWidth += width(part)
  }
  flushWord()
  if (stripAnsi(line).trim()) lines.push(line)
  return lines
}

export type RenderOptions = { columns: number; palette: Palette; base?: string; hyperlinks: boolean }

const absolute = (url: string) => (url.startsWith('/') ? `${profile.website}${url}` : url)

export function hyperlink(label: string, url: string, enabled: boolean): string {
  return enabled ? `${ESC}]8;;${url}${ESC}\\${label}${ESC}]8;;${ESC}\\` : label
}

// Inline markdown: escapes, `code`, **bold**, *italic* and [links](url).
// `cmd:` links name a command to type, since there is nothing to click.
export function inline(text: string, options: RenderOptions): string {
  const { palette: colors, base = '' } = options
  const restore = RESET + base
  let result = ''
  for (let index = 0; index < text.length;) {
    const rest = text.slice(index)
    const char = text[index]!
    let match: RegExpExecArray | null
    if (char === '\\' && index + 1 < text.length) { result += text[index + 1]; index += 2; continue }
    if ((match = /^`([^`]+)`/.exec(rest))) { result += colors.command + match[1] + restore; index += match[0].length; continue }
    if ((match = /^\*\*(.+?)\*\*/.exec(rest))) { result += sgr('1') + inline(match[1]!, options) + restore; index += match[0].length; continue }
    if ((match = /^\*([^*\s][^*]*)\*/.exec(rest)) && !/\w/.test(text[index - 1] ?? '')) { result += sgr('3') + inline(match[1]!, options) + restore; index += match[0].length; continue }
    if ((match = /^\[([^\]]*)\]\(([^)\s]*)\)/.exec(rest))) {
      const [, label = '', url = ''] = match
      if (url.startsWith('cmd:')) {
        const command = decodeURIComponent(url.slice(4))
        const shown = label.replace(/^`|`$/g, '')
        result += colors.command + shown + restore
        // Name the command unless the label already says it (`about/` for `cd about`).
        const word = shown.trim().replace(/\/$/, '').replace(/\.\w+$/, '')
        if (shown.trim() !== command && !command.split(/[\s/]+/).includes(word)) result += `${colors.muted} (${command})${restore}`
      } else {
        const href = absolute(url)
        const plainLabel = label.replace(/\\(.)/g, '$1')
        const sameAsUrl = plainLabel.replace(/^(https?:\/\/|mailto:)/, '').replace(/\/$/, '') === href.replace(/^(https?:\/\/|mailto:)/, '').replace(/\/$/, '')
        result += colors.link + sgr('4') + hyperlink(inline(plainLabel, { ...options, base: base + colors.link + sgr('4') }), href, options.hyperlinks) + restore
        if (!sameAsUrl) result += `${colors.muted} <${href.replace(/^mailto:/, '')}>${restore}`
      }
      index += match[0].length
      continue
    }
    result += char
    index++
  }
  return result
}

function table(rows: string[], options: RenderOptions): string[] {
  const cells = rows.filter((row) => !/^\|?\s*:?-{2,}/.test(row.trim())).map((row) => row.trim().replace(/^\||\|$/g, '').split('|').map((cell) => inline(cell.trim(), options)))
  const columns = Math.max(...cells.map((row) => row.length))
  const widths = Array.from({ length: columns }, (_, column) => Math.max(...cells.map((row) => width(row[column] ?? ''))))
  if (widths.reduce((sum, value) => sum + value + 3, 0) > options.columns) {
    const [header, ...body] = cells
    return body.flatMap((row) => row.map((cell, column) => wrap(`${options.palette.muted}${stripAnsi(header?.[column] ?? '')}:${RESET}${options.base ?? ''} ${cell}`, options.columns, '  ')).flat().concat(''))
  }
  return cells.map((row, rowIndex) => row.map((cell, column) => (rowIndex === 0 ? sgr('1') + cell + RESET + (options.base ?? '') : cell) + ' '.repeat(widths[column]! - width(cell))).join('   ').replace(/\s+$/, ''))
}

// Block markdown: headings, lists, quotes, tables, fences and paragraphs.
export function renderMarkdown(text: string, options: RenderOptions): string[] {
  const { columns, palette: colors, base = '' } = options
  const out: string[] = []
  const lines = text.split('\n')
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]!
    const fence = /^(```|~~~)/.exec(line)
    if (fence) {
      const block: string[] = []
      while (++index < lines.length && !lines[index]!.startsWith(fence[1]!)) block.push(lines[index]!)
      const plain = /^(```|~~~)text\b/.test(line) || !line.slice(3).trim()
      out.push(...block.map((item) => (plain ? base + item + RESET : colors.command + item + RESET)))
      continue
    }
    if (line.trim().startsWith('|')) {
      const rows = [line]
      while (index + 1 < lines.length && lines[index + 1]!.trim().startsWith('|')) rows.push(lines[++index]!)
      out.push(...table(rows, options).map((row) => base + row + RESET))
      continue
    }
    const heading = /^(#{1,6})\s+(.*)$/.exec(line)
    if (heading) {
      const level = heading[1]!.length
      const style = level === 1 ? colors.heading : level === 2 ? sgr('1') + colors.accent2 : sgr('1')
      if (out.length && out.at(-1) !== '' && level <= 2) out.push('')
      out.push(...wrap(style + inline(heading[2]!, { ...options, base: style }) + RESET, columns))
      continue
    }
    const bullet = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/.exec(line)
    if (bullet) {
      const depth = Math.floor(bullet[1]!.length / 2)
      const marker = /\d/.test(bullet[2]!) ? bullet[2]! : depth ? '◦' : '•'
      const lead = '  '.repeat(depth + 1)
      out.push(...wrap(`${base}${lead}${colors.accent}${marker}${RESET}${base} ${inline(bullet[3]!, options)}${RESET}`, columns, lead + ' '.repeat(width(marker) + 1)))
      continue
    }
    const quote = /^>\s?(.*)$/.exec(line)
    if (quote) { out.push(...wrap(`${colors.muted}│${RESET}${base} ${inline(quote[1]!, options)}${RESET}`, columns, `${colors.muted}│${RESET}${base} `)); continue }
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) { out.push(colors.muted + '─'.repeat(Math.min(columns, 40)) + RESET); continue }
    // Two or more spaces line up label/value rows (as in Contact), so keep them.
    out.push(...wrap(base + inline(line, options) + RESET, columns, ' '.repeat(Math.min(12, /^\w+\s{2,}/.exec(line)?.[0].length ?? 0))))
  }
  while (out.length && !stripAnsi(out.at(-1)!).trim()) out.pop()
  return out
}
