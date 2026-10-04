// Cursor motions for the read-only vim viewer. Pure functions over an array of
// lines, so the component only handles keys and rendering.

export type Pos = { row: number; col: number }

const clampCol = (lines: string[], row: number, col: number) => Math.max(0, Math.min(col, Math.max(0, (lines[row] ?? '').length - 1)))
export const clampPos = (lines: string[], pos: Pos): Pos => {
  const row = Math.max(0, Math.min(pos.row, lines.length - 1))
  return { row, col: clampCol(lines, row, pos.col) }
}

// vim "word" classes: keyword characters, other punctuation, and blanks.
const kind = (char: string | undefined) => (char === undefined || /\s/.test(char) ? 0 : /\w/.test(char) ? 1 : 2)

// Walks the buffer as one stream, with a virtual newline (blank) between lines.
function charAt(lines: string[], pos: Pos): string | undefined {
  const line = lines[pos.row]
  if (line === undefined) return undefined
  return pos.col < line.length ? line[pos.col] : '\n'
}
function next(lines: string[], pos: Pos): Pos | null {
  const line = lines[pos.row] ?? ''
  if (pos.col < line.length) return { row: pos.row, col: pos.col + 1 }
  return pos.row < lines.length - 1 ? { row: pos.row + 1, col: 0 } : null
}
function prev(lines: string[], pos: Pos): Pos | null {
  if (pos.col > 0) return { row: pos.row, col: Math.min(pos.col - 1, (lines[pos.row] ?? '').length) }
  return pos.row > 0 ? { row: pos.row - 1, col: (lines[pos.row - 1] ?? '').length } : null
}
const isEmptyLine = (lines: string[], pos: Pos) => (lines[pos.row] ?? '') === '' && pos.col === 0

export function wordForward(lines: string[], start: Pos): Pos {
  let pos: Pos | null = start
  const startKind = kind(charAt(lines, start))
  while (pos && startKind && kind(charAt(lines, pos)) === startKind) pos = next(lines, pos)
  while (pos && kind(charAt(lines, pos)) === 0 && !(isEmptyLine(lines, pos) && pos.row !== start.row)) pos = next(lines, pos)
  return pos ?? { row: lines.length - 1, col: Math.max(0, (lines.at(-1) ?? '').length - 1) }
}

export function wordBackward(lines: string[], start: Pos): Pos {
  let pos = prev(lines, start)
  while (pos && kind(charAt(lines, pos)) === 0 && !isEmptyLine(lines, pos)) pos = prev(lines, pos)
  if (!pos) return { row: 0, col: 0 }
  const target = kind(charAt(lines, pos))
  for (let before = prev(lines, pos); before && target && kind(charAt(lines, before)) === target; before = prev(lines, before)) pos = before
  return pos
}

export function wordEnd(lines: string[], start: Pos): Pos {
  let pos = next(lines, start)
  while (pos && kind(charAt(lines, pos)) === 0) pos = next(lines, pos)
  if (!pos) return start
  const target = kind(charAt(lines, pos))
  for (let after = next(lines, pos); after && kind(charAt(lines, after)) === target; after = next(lines, after)) pos = after
  return pos
}

const pairs: Record<string, string> = { '(': ')', '[': ']', '{': '}', ')': '(', ']': '[', '}': '{' }

export function matchPair(lines: string[], start: Pos): Pos {
  const line = lines[start.row] ?? ''
  let col = start.col
  while (col < line.length && !pairs[line[col]!]) col++
  if (col >= line.length) return start
  const open = line[col]!
  const close = pairs[open]!
  const forward = '([{'.includes(open)
  let depth = 0
  for (let pos: Pos | null = { row: start.row, col }; pos; pos = forward ? next(lines, pos) : prev(lines, pos)) {
    const char = charAt(lines, pos)
    if (char === open) depth++
    else if (char === close && --depth === 0) return pos
  }
  return start
}

export function paragraph(lines: string[], row: number, direction: 1 | -1): number {
  const inside = (index: number) => index >= 0 && index < lines.length
  let index = row
  while (inside(index) && lines[index]!.trim() === '') index += direction
  while (inside(index) && lines[index]!.trim() !== '') index += direction
  return Math.max(0, Math.min(lines.length - 1, index))
}

export function search(lines: string[], from: Pos, pattern: string, backward = false): Pos | null {
  if (!pattern) return null
  let regex: RegExp
  try { regex = new RegExp(pattern, /[A-Z]/.test(pattern) ? 'g' : 'gi') } catch { regex = new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi') }
  const hits = (row: number) => [...(lines[row] ?? '').matchAll(regex)].map((match) => match.index ?? 0)
  const count = lines.length
  for (let step = 0; step <= count; step++) {
    const row = ((backward ? from.row - step : from.row + step) % count + count) % count
    const cols = hits(row)
    const col = backward
      ? cols.filter((value) => step > 0 || value < from.col).at(-1)
      : cols.find((value) => step > 0 || value > from.col)
    if (col !== undefined) return { row, col }
  }
  return null
}

export const firstNonBlank = (line: string) => Math.max(0, line.search(/\S/))
