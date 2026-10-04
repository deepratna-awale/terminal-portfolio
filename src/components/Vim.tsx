import { useEffect, useRef, useState } from 'react'
import './Vim.css'

const splash = ['', '', 'VIM - Vi IMproved', '', 'version 9.1 (browser edition)', 'by Bram Moolenaar et al.', '', 'this one is read-only, like the rest of the portfolio', '', 'type  :q<Enter>        to exit', 'type  :e resume<Enter> to read my resume', 'type  :help<Enter>     if you are lost']

type Props = { file: string; text: string; onExit: (message: string) => void; open: (file: string) => { name: string; text: string } | undefined }

export function Vim({ file: initialFile, text: initialText, onExit, open }: Props) {
  const [file, setFile] = useState({ name: initialFile, text: initialText })
  const [top, setTop] = useState(0)
  const [command, setCommand] = useState<string | null>(null)
  const [message, setMessage] = useState(initialFile ? (initialText ? `"${initialFile}" [readonly] ${initialText.split('\n').length}L, ${initialText.length}B` : `"${initialFile}" [New File]`) : '')
  const [pending, setPending] = useState('')
  const [rows, setRows] = useState(24)
  const bodyRef = useRef<HTMLDivElement>(null)
  const lines = file.name ? file.text.split('\n') : []

  useEffect(() => {
    const measure = () => { const body = bodyRef.current; if (body) setRows(Math.max(5, Math.floor(body.clientHeight / parseFloat(getComputedStyle(body).lineHeight || '20')))) }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])

  useEffect(() => {
    const maxTop = Math.max(0, lines.length - rows + 1)
    const scroll = (delta: number) => setTop((current) => Math.min(maxTop, Math.max(0, current + delta)))
    const execute = (raw: string) => {
      const input = raw.trim()
      if (/^(q|q!|wq|wq!|x|qa|qa!|quit)$/.test(input)) { onExit(input.startsWith('w') || input === 'x' ? 'E45: \'readonly\' option is set... so you quit anyway. Achievement unlocked: escaped vim.' : 'You escaped vim. Achievement unlocked.'); return }
      if (input === 'w' || input === 'w!') { setMessage(input === 'w!' ? 'Nice try. The filesystem is an immutable container image.' : "E45: 'readonly' option is set (add ! to override)"); return }
      if (input === 'help') { setMessage('j/k scroll, ^d/^u half page, gg/G top/bottom, :e <file> open, :q quit'); return }
      if (/^\d+$/.test(input)) { setTop(Math.min(maxTop, Math.max(0, Number(input) - 1))); setMessage(''); return }
      const edit = input.match(/^e(?:dit)?\s+(.+)$/)
      if (edit) {
        const next = open(edit[1]!)
        if (!next) { setMessage(`E484: Can't open file ${edit[1]}`); return }
        setFile(next); setTop(0); setMessage(`"${next.name}" [readonly] ${next.text.split('\n').length}L, ${next.text.length}B`); return
      }
      setMessage(`E492: Not an editor command: ${input}`)
    }
    const handler = (event: KeyboardEvent) => {
      if (event.metaKey || (event.altKey && !event.ctrlKey)) return
      event.preventDefault()
      if (command !== null) {
        if (event.key === 'Escape') setCommand(null)
        else if (event.key === 'Enter') { setCommand(null); execute(command) }
        else if (event.key === 'Backspace') setCommand(command ? command.slice(0, -1) : null)
        else if (event.key.length === 1) setCommand(command + event.key)
        return
      }
      const key = event.ctrlKey ? `^${event.key.toLowerCase()}` : event.key
      if (key === ':') { setCommand(''); setMessage(''); return }
      if (pending === 'g' && key === 'g') { setTop(0); setPending(''); return }
      if (pending === 'Z' && (key === 'Z' || key === 'Q')) { onExit('You escaped vim. Achievement unlocked.'); return }
      setPending('')
      if (key === 'j' || key === 'ArrowDown' || key === 'Enter' || key === '^e') scroll(1)
      else if (key === 'k' || key === 'ArrowUp' || key === '^y') scroll(-1)
      else if (key === '^d' || key === ' ' || key === 'PageDown' || key === '^f') scroll(Math.floor(rows / 2))
      else if (key === '^u' || key === 'PageUp' || key === '^b') scroll(-Math.floor(rows / 2))
      else if (key === 'G' || key === 'End') setTop(maxTop)
      else if (key === 'Home') setTop(0)
      else if (key === 'g' || key === 'Z') setPending(key)
      else if (key === '^c') setMessage('Type  :qa!  and press <Enter> to abandon all changes and exit Vim')
      else if ('iaoIAOsScCR'.includes(key) && key.length === 1) setMessage('-- INSERT -- (just kidding: W10: Warning: Changing a readonly file)')
      else if (key === 'Escape') setMessage('')
      else if (key === 'u') setMessage('Already at oldest change')
      else if (key === 'd' || key === 'x') setMessage("E21: Cannot make changes, 'modifiable' is off")
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [command, lines.length, onExit, open, pending, rows])

  const visible = file.name ? lines.slice(top, top + rows - 1) : []
  const filler = Math.max(0, rows - 1 - visible.length)
  const percent = !lines.length ? 'All' : top === 0 && lines.length <= rows - 1 ? 'All' : top === 0 ? 'Top' : top + rows - 1 >= lines.length ? 'Bot' : `${Math.round((top / lines.length) * 100)}%`
  const width = String(lines.length).length

  return (
    <div className="vim" role="dialog" aria-modal="true" aria-label={`vim ${file.name}`}>
      <div className="vim-body" ref={bodyRef} onClick={() => setMessage('Mouse? In vim? Type :q to quit.')}>
        {visible.map((line, index) => (
          <div key={top + index} className="vim-line"><span className="vim-number">{String(top + index + 1).padStart(width + 1)} </span><span className={/^#/.test(line) ? 'vim-heading' : /^\s*•/.test(line) ? 'vim-bullet' : ''}>{line || ' '}</span></div>
        ))}
        {!file.name && <div className="vim-splash">{splash.map((line, index) => <div key={index}>{line || ' '}</div>)}</div>}
        {Array.from({ length: file.name ? filler : Math.max(0, filler - splash.length) }, (_, index) => <div key={`f${index}`} className="vim-tilde">~</div>)}
      </div>
      <div className="vim-status"><span>{file.name || '[No Name]'} [RO]</span><span>{lines.length ? `${top + 1},1` : '0,0-1'}   {percent}</span></div>
      <div className="vim-command">{command !== null ? <>:{command}<span className="vim-cursor"> </span></> : message}</div>
      <button type="button" className="vim-close" onClick={() => onExit('You escaped vim (with the mouse, but it counts).')} aria-label="Quit vim">:q</button>
    </div>
  )
}
