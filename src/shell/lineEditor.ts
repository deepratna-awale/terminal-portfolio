// Pure zsh/emacs-style line editing. Every function takes the line and cursor
// and returns the next state, so the terminal component stays a thin adapter.

export type LineState = { value: string; cursor: number; killRing: string }

const isWordChar = (char: string | undefined) => !!char && /[A-Za-z0-9_]/.test(char)

export function wordStartBefore(value: string, cursor: number): number {
  let index = cursor
  while (index > 0 && !isWordChar(value[index - 1])) index--
  while (index > 0 && isWordChar(value[index - 1])) index--
  return index
}

export function wordEndAfter(value: string, cursor: number): number {
  let index = cursor
  while (index < value.length && !isWordChar(value[index])) index++
  while (index < value.length && isWordChar(value[index])) index++
  return index
}

// ^W in zsh deletes back to the previous whitespace, not to punctuation.
function whitespaceWordStart(value: string, cursor: number): number {
  let index = cursor
  while (index > 0 && value[index - 1] === ' ') index--
  while (index > 0 && value[index - 1] !== ' ') index--
  return index
}

export type EditAction =
  | 'beginning-of-line' | 'end-of-line' | 'backward-char' | 'forward-char'
  | 'backward-word' | 'forward-word' | 'kill-line' | 'backward-kill-line'
  | 'backward-kill-word' | 'kill-word' | 'yank' | 'transpose-chars' | 'delete-char'

export function applyEdit(state: LineState, action: EditAction): LineState {
  const { value, cursor, killRing } = state
  switch (action) {
    case 'beginning-of-line': return { ...state, cursor: 0 }
    case 'end-of-line': return { ...state, cursor: value.length }
    case 'backward-char': return { ...state, cursor: Math.max(0, cursor - 1) }
    case 'forward-char': return { ...state, cursor: Math.min(value.length, cursor + 1) }
    case 'backward-word': return { ...state, cursor: wordStartBefore(value, cursor) }
    case 'forward-word': return { ...state, cursor: wordEndAfter(value, cursor) }
    case 'kill-line': return { value: value.slice(0, cursor), cursor, killRing: value.slice(cursor) || killRing }
    case 'backward-kill-line': return { value: value.slice(cursor), cursor: 0, killRing: value.slice(0, cursor) || killRing }
    case 'backward-kill-word': {
      const start = whitespaceWordStart(value, cursor)
      return { value: value.slice(0, start) + value.slice(cursor), cursor: start, killRing: value.slice(start, cursor) || killRing }
    }
    case 'kill-word': {
      const end = wordEndAfter(value, cursor)
      return { value: value.slice(0, cursor) + value.slice(end), cursor, killRing: value.slice(cursor, end) || killRing }
    }
    case 'yank': return { value: value.slice(0, cursor) + killRing + value.slice(cursor), cursor: cursor + killRing.length, killRing }
    case 'transpose-chars': {
      if (value.length < 2 || cursor === 0) return state
      const at = cursor === value.length ? cursor - 1 : cursor
      const chars = value.split('')
      ;[chars[at - 1], chars[at]] = [chars[at]!, chars[at - 1]!]
      return { ...state, value: chars.join(''), cursor: Math.min(value.length, at + 1) }
    }
    case 'delete-char': return { ...state, value: value.slice(0, cursor) + value.slice(cursor + 1) }
  }
}

// Map a keyboard event to a zsh binding. Uses event.code for Alt combos because
// macOS turns Option+B into "∫" in event.key.
export function bindingFor(event: { key: string; code: string; ctrlKey: boolean; altKey: boolean; metaKey: boolean }): EditAction | null {
  if (event.metaKey) return null
  if (event.ctrlKey && !event.altKey) {
    switch (event.key.toLowerCase()) {
      case 'a': return 'beginning-of-line'
      case 'e': return 'end-of-line'
      case 'b': return 'backward-char'
      case 'f': return 'forward-char'
      case 'k': return 'kill-line'
      case 'u': return 'backward-kill-line'
      case 'w': return 'backward-kill-word'
      case 'y': return 'yank'
      case 't': return 'transpose-chars'
      case 'h': return null
    }
  }
  if (event.altKey && !event.ctrlKey) {
    switch (event.code) {
      case 'KeyB': return 'backward-word'
      case 'KeyF': return 'forward-word'
      case 'KeyD': return 'kill-word'
      case 'Backspace': return 'backward-kill-word'
      case 'ArrowLeft': return 'backward-word'
      case 'ArrowRight': return 'forward-word'
    }
  }
  return null
}

// zsh history expansion: !!, !$, !n, !-n, !prefix
export function expandHistory(input: string, history: string[]): { value: string; error?: string } {
  if (!input.includes('!')) return { value: input }
  let error: string | undefined
  const value = input.replace(/!(!|\$|-?\d+|[A-Za-z][\w-]*)/g, (match, token: string) => {
    let entry: string | undefined
    if (token === '!') entry = history.at(-1)
    else if (token === '$') entry = history.at(-1)?.trim().split(/\s+/).at(-1)
    else if (/^-\d+$/.test(token)) entry = history.at(Number(token))
    else if (/^\d+$/.test(token)) entry = history[Number(token) - 1]
    else entry = [...history].reverse().find((item) => item.startsWith(token))
    if (entry === undefined) { error ??= `zsh: event not found: ${match.slice(1)}`; return match }
    return entry
  })
  return error ? { value: input, error } : { value }
}

export function reverseSearch(history: string[], query: string, skip = 0): string | undefined {
  if (!query) return history.at(-1 - skip)
  return [...history].reverse().filter((item) => item.includes(query))[skip]
}
