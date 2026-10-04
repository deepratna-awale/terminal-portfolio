// Text filters for `a | b | c` pipelines. Commands print markdown, so the
// first stage is flattened to plain text before any filter sees it.

export function toPlainText(markdown: string): string {
  return markdown
    .replace(/```\w*\n?/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/\*\*([^*]*)\*\*/g, '$1')
    .replace(/(^|\s)\*([^*\s][^*]*)\*/g, '$1$2')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^-\s+/gm, '• ')
}

type Filter = (input: string[], args: string[]) => string[] | { error: string }

function parseCount(args: string[], fallback: number): number {
  const flag = args.find((arg) => /^-n?\d+$/.test(arg)) ?? (args.includes('-n') ? `-${args[args.indexOf('-n') + 1]}` : undefined)
  const value = Number(flag?.replace(/^-n?/, ''))
  return Number.isFinite(value) && value > 0 ? value : fallback
}

export function grepLines(lines: string[], args: string[]): string[] | { error: string } {
  const flags = args.filter((arg) => /^-[a-z]+$/.test(arg)).join('')
  const pattern = args.find((arg) => !/^-[a-z]+$/.test(arg))
  if (!pattern) return { error: 'usage: grep [-ivc] <pattern>' }
  let regex: RegExp
  try { regex = new RegExp(pattern, flags.includes('i') ? 'i' : '') } catch { regex = new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags.includes('i') ? 'i' : '') }
  const matched = lines.filter((line) => regex.test(line) !== flags.includes('v'))
  return flags.includes('c') ? [String(matched.length)] : matched
}

export const filters: Record<string, Filter> = {
  grep: grepLines,
  head: (lines, args) => lines.slice(0, parseCount(args, 10)),
  tail: (lines, args) => lines.slice(-parseCount(args, 10)),
  sort: (lines, args) => { const sorted = [...lines].sort((a, b) => a.localeCompare(b)); return args.includes('-r') ? sorted.reverse() : sorted },
  uniq: (lines) => lines.filter((line, index) => line !== lines[index - 1]),
  rev: (lines) => lines.map((line) => [...line].reverse().join('')),
  tr: (lines, args) => args.includes('a-z') && args.includes('A-Z') ? lines.map((line) => (args.indexOf('a-z') < args.indexOf('A-Z') ? line.toUpperCase() : line.toLowerCase())) : { error: 'tr: only a-z A-Z (and back) is supported' },
  wc: (lines, args) => {
    const words = lines.join(' ').split(/\s+/).filter(Boolean).length
    const chars = lines.join('\n').length + (lines.length ? 1 : 0)
    if (args.includes('-l')) return [String(lines.length)]
    if (args.includes('-w')) return [String(words)]
    if (args.includes('-c') || args.includes('-m')) return [String(chars)]
    return [`${String(lines.length).padStart(8)}${String(words).padStart(8)}${String(chars).padStart(8)}`]
  },
}

export const filterNames = Object.keys(filters)
