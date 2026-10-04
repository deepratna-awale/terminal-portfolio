import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { clampPos, firstNonBlank, matchPair, paragraph, search, wordBackward, wordEnd, wordForward, type Pos } from '../shell/vim'
import './Vim.css'

const splash = ['', '', 'VIM - Vi IMproved', '', 'version 9.1 (browser edition)', 'by Bram Moolenaar et al.', '', 'edits stay in this tab: nothing is ever saved', '', 'type  :q<Enter>        to exit', 'type  :e resume<Enter> to read my resume', 'type  :help<Enter>     for the keys']
const help = 'hjkl w b e 0 ^ $ gg G {count} H M L ^d ^u ^f ^b { } % /search n N · i a o x dd u · :set rnu · :q'

type Mode = 'normal' | 'insert'
type Props = { file: string; text: string; onExit: (message: string) => void; open: (file: string) => { name: string; text: string } | undefined }

const replaceAt = (lines: string[], row: number, line: string) => lines.map((value, index) => (index === row ? line : value))
const info = (name: string, lines: string[]) => `"${name}" [readonly] ${lines.length}L, ${lines.join('\n').length}B`

export function Vim({ file: initialFile, text: initialText, onExit, open }: Props) {
  const [name, setName] = useState(initialFile)
  const [lines, setLines] = useState(() => (initialFile ? initialText.split('\n') : ['']))
  const [cursor, setCursor] = useState<Pos>({ row: 0, col: 0 })
  const [top, setTop] = useState(0)
  const [rows, setRows] = useState(24)
  const [mode, setMode] = useState<Mode>('normal')
  const [command, setCommand] = useState<{ prefix: ':' | '/' | '?'; text: string } | null>(null)
  const [message, setMessage] = useState(initialFile ? (initialText ? info(initialFile, initialText.split('\n')) : `"${initialFile}" [New File]`) : '')
  const [relative, setRelative] = useState(false)
  const [numbers, setNumbers] = useState(true)
  const [modified, setModified] = useState(false)
  const pending = useRef('')
  const count = useRef('')
  const want = useRef(0)
  const lastSearch = useRef<{ pattern: string; backward: boolean } | null>(null)
  const undo = useRef<Array<{ lines: string[]; cursor: Pos }>>([])
  const bodyRef = useRef<HTMLDivElement>(null)
  const cursorRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const measure = () => { const body = bodyRef.current; if (body) setRows(Math.max(5, Math.floor(body.clientHeight / parseFloat(getComputedStyle(body).lineHeight || '20')))) }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])

  // Keep the cursor on screen (long lines wrap, so check the real layout).
  useLayoutEffect(() => {
    if (cursor.row < top) { setTop(cursor.row); return }
    const body = bodyRef.current
    const mark = cursorRef.current
    if (body && mark && mark.getBoundingClientRect().bottom > body.getBoundingClientRect().bottom) setTop((value) => Math.min(value + 1, cursor.row))
    else if (!mark && cursor.row >= top + rows) setTop(cursor.row - rows + 1)
  }, [cursor, top, rows, lines])

  useEffect(() => {
    const move = (pos: Pos, keepWant = false) => {
      const next = clampPos(lines, pos)
      if (!keepWant) want.current = next.col
      setCursor(next)
    }
    const vertical = (delta: number) => move({ row: cursor.row + delta, col: want.current }, true)
    const snapshot = () => { undo.current = [...undo.current.slice(-50), { lines, cursor }]; setModified(true) }
    const edit = (next: string[], pos: Pos) => { setLines(next.length ? next : ['']); setCursor(pos) }

    const runSearch = (pattern: string, backward: boolean) => {
      const found = search(lines, cursor, pattern, backward)
      if (found) { move(found); setMessage(`${backward ? '?' : '/'}${pattern}`) } else setMessage(`E486: Pattern not found: ${pattern}`)
    }

    const execute = (raw: string) => {
      const input = raw.trim()
      if (/^(q|quit|qa|x|wq|q!|qa!|wq!|x!)$/.test(input)) {
        if (modified && (input === 'q' || input === 'quit' || input === 'qa')) { setMessage('E37: No write since last change (add ! to override)'); return }
        onExit(input.startsWith('w') || input.startsWith('x') ? "E45: 'readonly' option is set... so you quit anyway. Achievement unlocked: escaped vim." : 'You escaped vim. Achievement unlocked.')
        return
      }
      if (input === 'w' || input === 'w!') { setMessage(input === 'w!' ? 'Nice try. The filesystem is an immutable container image.' : "E45: 'readonly' option is set (add ! to override)"); return }
      if (input === 'help' || input === 'h') { setMessage(help); return }
      if (/^set (rnu|relativenumber)$/.test(input)) { setRelative(true); setNumbers(true); setMessage(''); return }
      if (/^set (nornu|norelativenumber)$/.test(input)) { setRelative(false); setMessage(''); return }
      if (/^set (nu|number)$/.test(input)) { setNumbers(true); setMessage(''); return }
      if (/^set (nonu|nonumber)$/.test(input)) { setNumbers(false); setRelative(false); setMessage(''); return }
      if (/^\d+$/.test(input)) { move({ row: Number(input) - 1, col: firstNonBlank(lines[Number(input) - 1] ?? '') }); setMessage(''); return }
      if (input === '$') { move({ row: lines.length - 1, col: 0 }); return }
      const target = input.match(/^e(?:dit)?!?\s+(.+)$/)
      if (target) {
        const next = open(target[1]!)
        if (!next) { setMessage(`E484: Can't open file ${target[1]}`); return }
        if (modified && !input.startsWith('e!')) { setMessage('E37: No write since last change (add ! to override)'); return }
        const nextLines = next.text.split('\n')
        setName(next.name); setLines(nextLines); setCursor({ row: 0, col: 0 }); setTop(0); setModified(false); undo.current = []
        setMessage(info(next.name, nextLines))
        return
      }
      setMessage(`E492: Not an editor command: ${input}`)
    }

    const insertKey = (event: KeyboardEvent) => {
      const line = lines[cursor.row] ?? ''
      if (event.key === 'Escape' || (event.ctrlKey && event.key === '[')) { setMode('normal'); setMessage(''); move({ row: cursor.row, col: cursor.col - 1 }); return }
      if (event.key === 'Enter') { edit([...lines.slice(0, cursor.row), line.slice(0, cursor.col), line.slice(cursor.col), ...lines.slice(cursor.row + 1)], { row: cursor.row + 1, col: 0 }); return }
      if (event.key === 'Backspace') {
        if (cursor.col > 0) edit(replaceAt(lines, cursor.row, line.slice(0, cursor.col - 1) + line.slice(cursor.col)), { row: cursor.row, col: cursor.col - 1 })
        else if (cursor.row > 0) { const above = lines[cursor.row - 1]!; edit([...lines.slice(0, cursor.row - 1), above + line, ...lines.slice(cursor.row + 1)], { row: cursor.row - 1, col: above.length }) }
        return
      }
      if (event.key.startsWith('Arrow')) { const delta = { ArrowLeft: [0, -1], ArrowRight: [0, 1], ArrowUp: [-1, 0], ArrowDown: [1, 0] }[event.key]!; setCursor({ row: Math.max(0, Math.min(lines.length - 1, cursor.row + delta[0]!)), col: Math.max(0, cursor.col + delta[1]!) }); return }
      if (event.key.length === 1 && !event.ctrlKey) edit(replaceAt(lines, cursor.row, line.slice(0, cursor.col) + event.key + line.slice(cursor.col)), { row: cursor.row, col: cursor.col + 1 })
    }

    const normalKey = (event: KeyboardEvent) => {
      const key = event.ctrlKey ? `^${event.key.toLowerCase()}` : event.key
      if (/^[1-9]$/.test(key) || (key === '0' && count.current)) { count.current += key; return }
      const n = Math.max(1, Number(count.current) || 1)
      const counted = Boolean(count.current)
      count.current = ''
      const line = lines[cursor.row] ?? ''
      const half = Math.max(1, Math.floor(rows / 2))

      if (pending.current) {
        const combo = pending.current + key
        pending.current = ''
        if (combo === 'gg') { move({ row: counted ? n - 1 : 0, col: firstNonBlank(lines[counted ? n - 1 : 0] ?? '') }); return }
        if (combo === 'ZZ' || combo === 'ZQ') { onExit('You escaped vim. Achievement unlocked.'); return }
        if (combo === 'dd') { snapshot(); const next = lines.filter((_, index) => index < cursor.row || index >= cursor.row + n); edit(next, clampPos(next.length ? next : [''], { row: cursor.row, col: 0 })); return }
        if (combo === 'yy') { setMessage(`${n} line${n > 1 ? 's' : ''} yanked`); return }
        return
      }

      switch (key) {
        case 'h': case 'ArrowLeft': case 'Backspace': move({ row: cursor.row, col: cursor.col - n }); return
        case 'l': case 'ArrowRight': case ' ': move({ row: cursor.row, col: cursor.col + n }); return
        case 'j': case 'ArrowDown': case '^n': case '^e': vertical(n); return
        case 'k': case 'ArrowUp': case '^p': case '^y': vertical(-n); return
        case 'Enter': case '+': move({ row: cursor.row + n, col: firstNonBlank(lines[cursor.row + n] ?? '') }); return
        case '-': move({ row: cursor.row - n, col: firstNonBlank(lines[cursor.row - n] ?? '') }); return
        case 'w': case 'W': { let pos = cursor; for (let i = 0; i < n; i++) pos = wordForward(lines, pos); move(pos); return }
        case 'b': case 'B': { let pos = cursor; for (let i = 0; i < n; i++) pos = wordBackward(lines, pos); move(pos); return }
        case 'e': case 'E': { let pos = cursor; for (let i = 0; i < n; i++) pos = wordEnd(lines, pos); move(pos); return }
        case '0': case 'Home': move({ row: cursor.row, col: 0 }); return
        case '^': move({ row: cursor.row, col: firstNonBlank(line) }); return
        case '$': case 'End': move({ row: cursor.row + n - 1, col: Infinity }); want.current = Infinity; return
        case 'G': move({ row: counted ? n - 1 : lines.length - 1, col: firstNonBlank(lines[counted ? n - 1 : lines.length - 1] ?? '') }); return
        case 'H': move({ row: top + (counted ? n - 1 : 0), col: 0 }); return
        case 'M': move({ row: top + Math.floor(Math.min(rows - 1, lines.length - top) / 2), col: 0 }); return
        case 'L': move({ row: Math.min(lines.length - 1, top + rows - 2) - (counted ? n - 1 : 0), col: 0 }); return
        case '^d': case 'PageDown': setTop((value) => Math.min(Math.max(0, lines.length - 1), value + half)); vertical(half); return
        case '^u': case 'PageUp': setTop((value) => Math.max(0, value - half)); vertical(-half); return
        case '^f': setTop((value) => Math.min(Math.max(0, lines.length - 1), value + rows - 2)); vertical(rows - 2); return
        case '^b': setTop((value) => Math.max(0, value - rows + 2)); vertical(-(rows - 2)); return
        case '}': { let row = cursor.row; for (let i = 0; i < n; i++) row = paragraph(lines, row, 1); move({ row, col: 0 }); return }
        case '{': { let row = cursor.row; for (let i = 0; i < n; i++) row = paragraph(lines, row, -1); move({ row, col: 0 }); return }
        case '%': move(matchPair(lines, cursor)); return
        case 'n': case 'N': {
          if (!lastSearch.current) { setMessage('E35: No previous regular expression'); return }
          runSearch(lastSearch.current.pattern, key === 'N' ? !lastSearch.current.backward : lastSearch.current.backward)
          return
        }
        case '*': { const word = (line.slice(0, cursor.col + 1).match(/\w*$/)?.[0] ?? '') + (line.slice(cursor.col + 1).match(/^\w*/)?.[0] ?? ''); if (word) { lastSearch.current = { pattern: `\\b${word}\\b`, backward: false }; runSearch(`\\b${word}\\b`, false) } return }
        case ':': case '/': case '?': setCommand({ prefix: key, text: '' }); setMessage(''); return
        case 'g': case 'Z': case 'd': case 'y': pending.current = key; return
        case 'i': case 'a': case 'I': case 'A': case 'o': case 'O': {
          snapshot()
          setMode('insert')
          setMessage('-- INSERT --  (scratch only: changes are never saved)')
          if (key === 'a') setCursor({ row: cursor.row, col: Math.min(cursor.col + 1, line.length) })
          if (key === 'A') setCursor({ row: cursor.row, col: line.length })
          if (key === 'I') setCursor({ row: cursor.row, col: firstNonBlank(line) })
          if (key === 'o' || key === 'O') { const at = key === 'o' ? cursor.row + 1 : cursor.row; setLines([...lines.slice(0, at), '', ...lines.slice(at)]); setCursor({ row: at, col: 0 }) }
          return
        }
        case 'x': if (line) { snapshot(); edit(replaceAt(lines, cursor.row, line.slice(0, cursor.col) + line.slice(cursor.col + n)), clampPos(replaceAt(lines, cursor.row, line.slice(0, cursor.col) + line.slice(cursor.col + n)), cursor)) } return
        case 'u': { const last = undo.current.pop(); if (last) { setLines(last.lines); setCursor(last.cursor); setModified(undo.current.length > 0); setMessage('1 change; before #1') } else setMessage('Already at oldest change'); return }
        case '^g': setMessage(`"${name || '[No Name]'}"${modified ? ' [Modified]' : ''} ${lines.length} lines --${Math.round(((cursor.row + 1) / lines.length) * 100)}%--`); return
        case '^c': setMessage('Type  :qa!  and press <Enter> to abandon all changes and exit Vim'); return
        case 'Escape': setMessage(''); return
      }
    }

    const handler = (event: KeyboardEvent) => {
      if (event.metaKey) return
      event.preventDefault()
      event.stopPropagation()
      if (command) {
        if (event.key === 'Escape' || (event.ctrlKey && event.key === 'c')) setCommand(null)
        else if (event.key === 'Enter') {
          setCommand(null)
          if (command.prefix === ':') execute(command.text)
          else if (command.text || lastSearch.current) {
            const pattern = command.text || lastSearch.current!.pattern
            lastSearch.current = { pattern, backward: command.prefix === '?' }
            runSearch(pattern, command.prefix === '?')
          }
        } else if (event.key === 'Backspace') setCommand(command.text ? { ...command, text: command.text.slice(0, -1) } : null)
        else if (event.key.length === 1 && !event.ctrlKey) setCommand({ ...command, text: command.text + event.key })
        return
      }
      if (mode === 'insert') insertKey(event)
      else normalKey(event)
    }
    window.addEventListener('keydown', handler, true)
    return () => window.removeEventListener('keydown', handler, true)
  }, [command, cursor, lines, mode, modified, name, onExit, open, rows, top])

  const visible = name ? lines.slice(top, top + rows - 1) : []
  const filler = Math.max(0, rows - 1 - visible.length)
  const percent = lines.length <= rows - 1 ? 'All' : top === 0 ? 'Top' : top + rows - 1 >= lines.length ? 'Bot' : `${Math.round((top / lines.length) * 100)}%`
  const width = Math.max(3, String(lines.length).length)
  const gutter = (row: number) => {
    if (!numbers) return null
    const label = relative && row !== cursor.row ? Math.abs(row - cursor.row) : row + 1
    return <span className={`vim-number${row === cursor.row ? ' current' : ''}`}>{String(label)[relative && row === cursor.row ? 'padEnd' : 'padStart'](width)} </span>
  }

  return (
    <div className={`vim vim-${mode}`} role="dialog" aria-modal="true" aria-label={`vim ${name}`}>
      <div className="vim-body" ref={bodyRef}>
        {visible.map((line, index) => {
          const row = top + index
          const heading = /^#/.test(line) ? 'vim-heading' : /^\s*•/.test(line) ? 'vim-bullet' : ''
          if (row !== cursor.row) return <div key={row} className="vim-line">{gutter(row)}<span className={heading}>{line || ' '}</span></div>
          const col = Math.min(cursor.col, line.length)
          return (
            <div key={row} className="vim-line vim-cursorline">
              {gutter(row)}
              <span className={heading}>{line.slice(0, col)}<span ref={cursorRef} className="vim-cursor">{line[col] ?? ' '}</span>{line.slice(col + 1)}</span>
            </div>
          )
        })}
        {!name && <div className="vim-splash">{splash.map((line, index) => <div key={index}>{line || ' '}</div>)}</div>}
        {Array.from({ length: name ? filler : Math.max(0, filler - splash.length) }, (_, index) => <div key={`f${index}`} className="vim-tilde">~</div>)}
      </div>
      <div className="vim-status">
        <span><span className="vim-mode">{mode === 'insert' ? 'INSERT' : 'NORMAL'}</span> {name || '[No Name]'} [RO]{modified ? ' [+]' : ''}</span>
        <span>{cursor.row + 1},{Math.min(cursor.col, (lines[cursor.row] ?? '').length) + 1}   {percent}</span>
      </div>
      <div className="vim-command">{command ? <>{command.prefix}{command.text}<span className="vim-command-cursor"> </span></> : message}</div>
      <button type="button" className="vim-close" onClick={() => onExit('You escaped vim (with the mouse, but it counts).')} aria-label="Quit vim">:q</button>
    </div>
  )
}
