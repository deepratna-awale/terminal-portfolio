import { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from 'react'
import ReactMarkdown, { defaultUrlTransform } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { askAssistant, fetchCowthink, fetchProjects, type ChatTurn, type Project } from '../api'
import { asciiLogo, motd, os, profile } from '../content'
import { commands, commandNames, directories, neofetchInfo, openExternal, resolveAlias, tokenize, type Line, type NewLine, type ShellContext } from '../shell/commands'
import { initialCommand, pipeSplit, unshareable } from '../shell/deeplink'
import { filterNames, filters, toPlainText } from '../shell/pipes'
import { closest, looksLikeCommand } from '../shell/typo'
import { commonPrefix, complete, suggestion as suggest } from '../shell/completion'
import { FitPre } from './FitPre'
import { ProjectCards, SectionView } from './SectionView'
import { applyEdit, bindingFor, expandHistory, reverseSearch, type LineState } from '../shell/lineEditor'
import { themeNames, themes, type ThemeName } from '../themes'

export type TerminalHandle = { run: (command: string) => void; print: (lines: NewLine[]) => void; clear: () => void; focus: () => void; replayBoot: () => void; paste: (text: string) => void; selectAll: () => void }
type Props = { theme: ThemeName; ui: ShellContext['ui']; onStatus: (status: string) => void; suspended?: boolean }

const HISTORY_KEY = 'portfolio.history'
const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function loadHistory(): string[] {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]') as string[] } catch { return [] }
}

function bootScript(theme: ThemeName): Array<{ line: NewLine; delay: number; typed?: boolean }> {
  const fingerprint = 'SHA256:dA7r/MjQ9xP2nKfE0wq+Zs3vTbYc8LuHg5oVe1iN4Ws'
  return [
    { line: { type: 'command', text: `guest@internet ~ % ssh guest@${profile.host}` }, delay: 250, typed: true },
    { line: { type: 'muted', text: `Resolving ${profile.host} ... ok` }, delay: 260 },
    { line: { type: 'muted', text: `Connecting to ${profile.host} port 22 ... connected.` }, delay: 320 },
    { line: { type: 'muted', text: `ED25519 key fingerprint is ${fingerprint}.` }, delay: 180 },
    { line: { type: 'muted', text: `Warning: Permanently added '${profile.host}' (ED25519) to the list of known hosts.` }, delay: 220 },
    { line: { type: 'muted', text: 'Authenticating as guest (publickey) ... accepted.' }, delay: 300 },
    { line: { type: 'muted', text: 'Allocating pty, starting zsh ... done.' }, delay: 260 },
    { line: { type: 'ascii', text: asciiLogo }, delay: 120 },
    { line: { type: 'neofetch', text: `${profile.handle}@${profile.host}`, info: neofetchInfo(theme) }, delay: 160 },
    { line: { type: 'output', text: `Welcome to **${os.name} ${os.version}** on ${profile.host}` }, delay: 120 },
    { line: { type: 'muted', text: [profile.title, ...motd, `Last login: ${new Date().toUTCString()} from your browser`].filter(Boolean).map((item) => `  * ${item}`).join('\n') }, delay: 120 },
    { line: { type: 'success', text: 'Type [`help`](cmd:help) to explore, [`projects`](cmd:projects) for my GitHub, or just ask a question in plain English.' }, delay: 0 },
  ]
}

export const Terminal = forwardRef<TerminalHandle, Props>(function Terminal({ theme, ui, onStatus, suspended = false }, ref) {
  const [transcript, setTranscript] = useState<Line[]>([])
  const [line, setLine] = useState<LineState>({ value: '', cursor: 0, killRing: '' })
  const [path, setPathState] = useState('~')
  const [history, setHistory] = useState<string[]>(loadHistory)
  const [historyIndex, setHistoryIndex] = useState(-1)
  const [draft, setDraft] = useState('')
  const [search, setSearch] = useState<{ query: string; skip: number } | null>(null)
  const [busy, setBusy] = useState(false)
  const [booting, setBooting] = useState(true)
  const [projectNames, setProjectNames] = useState<string[]>([])
  const [showScrollButton, setShowScrollButton] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const nextId = useRef(1)
  const pathRef = useRef('~')
  const previousPathRef = useRef('~')
  const historyRef = useRef(history)
  const chatRef = useRef<ChatTurn[]>([])
  const abortRef = useRef<AbortController | null>(null)
  const bootRun = useRef(0)
  const skipBoot = useRef(false)
  const lastTab = useRef(0)
  const suspendedRef = useRef(suspended)
  const deepLinkDone = useRef(false)
  useEffect(() => { historyRef.current = history }, [history])
  useEffect(() => {
    suspendedRef.current = suspended
    if (suspended) inputRef.current?.blur()
    else if (!booting && !busy) inputRef.current?.focus({ preventScroll: true })
  }, [suspended]) // oxlint-disable-line react-hooks/exhaustive-deps -- only react to overlays opening and closing

  const promptPath = path === '~' ? '~' : `~/${path}`
  const ghost = useMemo(() => (search || line.cursor !== line.value.length ? '' : suggest(line.value, history, path, projectNames, themeNames)), [line, history, path, projectNames, search])
  const searchMatch = search ? reverseSearch(history, search.query, search.skip) : undefined

  const print = useCallback((lines: NewLine[]) => {
    setTranscript((current) => [...current, ...lines.map((item) => ({ ...item, id: nextId.current++ }))])
  }, [])
  const updateLine = useCallback((id: number, text: string, type?: Line['type']) => {
    setTranscript((current) => current.map((item) => (item.id === id ? { ...item, text, type: type ?? item.type } : item)))
  }, [])
  const setPath = useCallback((next: string) => { previousPathRef.current = pathRef.current; pathRef.current = next; setPathState(next) }, [])

  const projects = useCallback(async (): Promise<Project[]> => {
    const list = await fetchProjects()
    setProjectNames(list.map((project) => project.name))
    return list
  }, [])

  useEffect(() => { projects().catch(() => {}) }, [projects])
  useEffect(() => { try { localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(-200))) } catch { /* storage unavailable */ } }, [history])
  useEffect(() => { if (!showScrollButton) bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight }) }, [transcript, line, showScrollButton, busy])
  useLayoutEffect(() => {
    const input = inputRef.current
    if (input && document.activeElement === input && input.selectionStart !== line.cursor) input.setSelectionRange(line.cursor, line.cursor)
  }, [line])

  const ask = useCallback(async (question: string) => {
    const controller = new AbortController()
    abortRef.current = controller
    const id = nextId.current++
    setTranscript((current) => [...current, { id, type: 'muted', text: '⠋ thinking ...' }])
    const frames = '⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏'
    let frame = 0
    const spinner = setInterval(() => updateLine(id, `${frames[++frame % frames.length]} thinking ...`), 90)
    onStatus('● asking Bedrock (Claude Haiku 4.5)')
    try {
      const turns: ChatTurn[] = [...chatRef.current.slice(-6), { role: 'user', content: question }]
      const reply = await askAssistant(turns, controller.signal)
      clearInterval(spinner)
      chatRef.current = [...turns, { role: 'assistant', content: reply }]
      if (reducedMotion()) { updateLine(id, reply, 'assistant'); return }
      for (let shown = 0; shown < reply.length; shown += 6) {
        if (controller.signal.aborted) break
        updateLine(id, reply.slice(0, shown), 'assistant')
        await sleep(12)
      }
      updateLine(id, reply, 'assistant')
    } catch (error) {
      clearInterval(spinner)
      if (controller.signal.aborted) updateLine(id, '^C', 'muted')
      else updateLine(id, `assistant: ${error instanceof Error ? error.message : 'unavailable right now'}. Try \`help\` for built-in commands.`, 'error')
    } finally {
      clearInterval(spinner)
      abortRef.current = null
      onStatus('')
    }
  }, [onStatus, updateLine])

  const context = useCallback((): ShellContext => ({
    path: pathRef.current, previousPath: previousPathRef.current, history: historyRef.current, theme,
    setPath, print, clear: () => setTranscript([]), projects, ask, ui,
  }), [ask, print, projects, setPath, theme, ui])

  const runPipeline = useCallback(async (stages: string[]) => {
    const captured: NewLine[] = []
    const base = context()
    const [first = '', ...rest] = stages
    const [name = '', ...args] = tokenize(resolveAlias(first))
    const command = commands[name]
    if (!command) { print([{ type: 'error', text: `zsh: command not found: ${name}` }]); return }
    await command.run(args, { ...base, print: (lines) => {
      captured.push(...lines.filter((line) => line.type !== 'muted' && line.type !== 'error'))
      const errors = lines.filter((line) => line.type === 'error')
      if (errors.length) print(errors)
    } })
    let lines = captured.flatMap((line) => (line.type === 'neofetch' ? [line.text, ...(line.info ?? [])] : toPlainText(line.text).split('\n')))
    let art = false
    for (const stage of rest) {
      const [filter = '', ...filterArgs] = tokenize(stage)
      if (filter === 'cowthink' || filter === 'cowsay') {
        art = true
        try { lines = (await fetchCowthink(lines.join(' ').replace(/\s+/g, ' ').slice(0, 280))).split('\n') } catch (error) { print([{ type: 'error', text: error instanceof Error ? error.message : 'cowthink is unavailable' }]); return }
        continue
      }
      if (filter === 'less' || filter === 'more' || filter === 'cat') continue
      const apply = filters[filter]
      if (!apply) { const guess = closest(filter, [...filterNames, 'cowthink']); print([{ type: 'error', text: `zsh: command not found: ${filter}` }, ...(guess ? [{ type: 'muted' as const, text: `did you mean \`${guess}\`? Pipes support: ${filterNames.join(', ')}, cowthink` }] : [])]); return }
      const result = apply(lines, filterArgs)
      if (!Array.isArray(result)) { print([{ type: 'error', text: result.error }]); return }
      lines = result
    }
    print([art ? { type: 'output', text: `\`\`\`text\n${lines.join('\n')}\n\`\`\`` } : { type: 'plain', text: lines.join('\n') || '(no output)' }])
  }, [context, print])

  const runSingle = useCallback(async (raw: string) => {
    const segments = pipeSplit(raw)
    if (segments.length > 1) { await runPipeline(segments); return }
    const expanded = resolveAlias(raw)
    const [name = '', ...args] = tokenize(expanded)
    const command = commands[name] ?? commands[name.toLowerCase()]
    if (command) { await command.run(args, context()); return }
    if (looksLikeCommand(raw) && raw.length < 40) {
      const guess = closest(name, commandNames.filter((candidate) => !commands[candidate]?.hidden || candidate.length > 2))
      if (guess) {
        const fixed = [guess, ...args].join(' ')
        print([{ type: 'error', text: `zsh: command not found: ${name}` }, { type: 'muted', text: `did you mean [\`${fixed}\`](cmd:${encodeURIComponent(fixed)})?` }])
        return
      }
      if (raw.trim().split(/\s+/).length === 1 && directories.includes(name.replace(/\/$/, ''))) { await commands.cd!.run([name], context()); return }
    }
    await ask(raw.trim())
  }, [ask, context, print, runPipeline])

  const run = useCallback(async (input: string, echo = true) => {
    const trimmed = input.trim()
    if (echo) print([{ type: 'command', text: `guest@${profile.host} ${pathRef.current === '~' ? '~' : `~/${pathRef.current}`} % ${input}` }])
    if (!trimmed) return
    const { value, error } = expandHistory(trimmed, historyRef.current)
    if (error) { print([{ type: 'error', text: error }]); return }
    if (value !== trimmed) print([{ type: 'muted', text: value }])
    setHistory((current) => (current.at(-1) === value ? current : [...current, value]))
    setHistoryIndex(-1)
    setBusy(true)
    try {
      for (const part of value.split(/\s*(?:&&|;)\s*/).filter(Boolean)) await runSingle(part)
      const first = tokenize(resolveAlias(value))[0] ?? ''
      if (commands[first] && !commands[first]!.hidden && !unshareable.has(first) && !value.includes('|')) {
        try { window.history.replaceState(null, '', `/?cmd=${encodeURIComponent(value)}`) } catch { /* sandboxed */ }
      }
    } finally {
      setBusy(false)
    }
  }, [print, runSingle])

  const boot = useCallback(async () => {
    const runId = ++bootRun.current
    // A deep link skips the login animation, once per page load.
    const initial = deepLinkDone.current ? null : initialCommand(window.location)
    skipBoot.current = reducedMotion() || Boolean(initial)
    // Yield once so a boot cancelled straight away (StrictMode remount) stops here.
    await sleep(0)
    if (runId !== bootRun.current) return
    setBooting(true)
    setTranscript([])
    onStatus('○ connecting ...')
    for (const step of bootScript(theme)) {
      if (runId !== bootRun.current) return
      if (step.typed && !skipBoot.current) {
        const id = nextId.current++
        setTranscript((current) => [...current, { ...step.line, id, text: '' }])
        for (let index = 1; index <= step.line.text.length && !skipBoot.current; index++) {
          updateLine(id, step.line.text.slice(0, index))
          await sleep(index < 18 ? 8 : 38)
          if (runId !== bootRun.current) return
        }
        updateLine(id, step.line.text)
      } else print([step.line])
      if (!skipBoot.current) await sleep(step.delay)
    }
    if (runId !== bootRun.current) return
    setBooting(false)
    onStatus('')
    if (initial) { deepLinkDone.current = true; run(initial) }
  }, [onStatus, print, run, theme, updateLine])

  useEffect(() => {
    boot()
    return () => { bootRun.current++ }
  }, []) // oxlint-disable-line react-hooks/exhaustive-deps -- boot once on mount

  // The input row is hidden while booting or running, so focus once it is visible again.
  useEffect(() => { if (!booting && !busy && !suspendedRef.current) inputRef.current?.focus({ preventScroll: true }) }, [booting, busy])

  // Typing anywhere on the page goes to the prompt, like a real terminal window.
  useEffect(() => {
    const redirect = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (suspendedRef.current || event.metaKey || event.ctrlKey || event.altKey || target?.closest('input, textarea')) return
      if (target?.closest('button, a') && (event.key === 'Enter' || event.key === ' ')) return
      if (event.key.length === 1 || event.key === 'Enter' || event.key.startsWith('Arrow')) inputRef.current?.focus({ preventScroll: true })
    }
    window.addEventListener('keydown', redirect)
    return () => window.removeEventListener('keydown', redirect)
  }, [])

  useEffect(() => {
    if (!booting) return
    const skip = () => { skipBoot.current = true }
    window.addEventListener('keydown', skip)
    window.addEventListener('pointerdown', skip)
    return () => { window.removeEventListener('keydown', skip); window.removeEventListener('pointerdown', skip) }
  }, [booting])

  useImperativeHandle(ref, () => ({
    run: (command) => { run(command) },
    print,
    clear: () => setTranscript([]),
    focus: () => inputRef.current?.focus(),
    replayBoot: () => { boot() },
    paste: (text) => setLine((current) => ({ ...current, value: current.value.slice(0, current.cursor) + text + current.value.slice(current.cursor), cursor: current.cursor + text.length })),
    selectAll: () => {
      const body = bodyRef.current
      if (!body) return
      const range = document.createRange()
      range.selectNodeContents(body)
      window.getSelection()?.removeAllRanges()
      window.getSelection()?.addRange(range)
    },
  }), [boot, print, run])

  const setValue = (value: string) => setLine((current) => ({ ...current, value, cursor: value.length }))

  const recallHistory = (direction: 1 | -1) => {
    if (!history.length) return
    const index = historyIndex === -1 && direction === 1 ? 0 : historyIndex + direction
    if (historyIndex === -1 && direction === 1) setDraft(line.value)
    if (index < 0) { setHistoryIndex(-1); setValue(draft); return }
    const nextIndex = Math.min(index, history.length - 1)
    setHistoryIndex(nextIndex)
    setValue(history[history.length - 1 - nextIndex] ?? '')
  }

  const handleTab = () => {
    const { prefix, fragment, candidates } = complete(line.value.slice(0, line.cursor), path, projectNames, themeNames)
    const rest = line.value.slice(line.cursor)
    const now = Date.now()
    const doubleTab = now - lastTab.current < 600
    lastTab.current = now
    if (!candidates.length) return
    if (candidates.length === 1) {
      const choice = candidates[0]!
      const insert = prefix + choice + (choice.endsWith('/') ? '' : ' ')
      setLine((current) => ({ ...current, value: insert + rest, cursor: insert.length }))
      return
    }
    const shared = commonPrefix(candidates)
    if (shared.length > fragment.length) {
      const insert = prefix + shared
      setLine((current) => ({ ...current, value: insert + rest, cursor: insert.length }))
      if (!doubleTab) return
    }
    print([{ type: 'command', text: `guest@${profile.host} ${promptPath} % ${line.value}` }, { type: 'muted', text: candidates.join('  ') }])
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    // Games, vim and Chrome own the keyboard while they are open.
    if (booting || suspendedRef.current) { event.preventDefault(); return }
    const key = event.key
    const ctrl = event.ctrlKey && !event.metaKey && !event.altKey

    if (ctrl && key.toLowerCase() === 'c') {
      event.preventDefault()
      if (abortRef.current) { abortRef.current.abort(); return }
      print([{ type: 'command', text: `guest@${profile.host} ${promptPath} % ${search ? '' : line.value}^C` }])
      setSearch(null); setLine((current) => ({ ...current, value: '', cursor: 0 })); setHistoryIndex(-1)
      return
    }
    if (busy) { event.preventDefault(); return }

    if (search) {
      if (ctrl && key.toLowerCase() === 'r') { event.preventDefault(); setSearch({ ...search, skip: search.skip + 1 }); return }
      if (key === 'Enter') { event.preventDefault(); const match = searchMatch ?? ''; setSearch(null); setValue(''); run(match); return }
      if (key === 'Escape' || (ctrl && key.toLowerCase() === 'g')) { event.preventDefault(); setSearch(null); setValue(draft); return }
      if (key === 'Backspace') { event.preventDefault(); setSearch({ query: search.query.slice(0, -1), skip: 0 }); return }
      if (key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) { event.preventDefault(); setSearch({ query: search.query + key, skip: 0 }); return }
      if (key.startsWith('Arrow') || key === 'Tab' || ctrl) { event.preventDefault(); setSearch(null); setValue(searchMatch ?? ''); return }
      return
    }

    if (key === 'Enter') {
      event.preventDefault()
      const value = line.value
      setLine((current) => ({ ...current, value: '', cursor: 0 }))
      run(value)
      return
    }
    if (key === 'Tab') { event.preventDefault(); handleTab(); return }
    if (key === 'ArrowUp' || (ctrl && key.toLowerCase() === 'p')) { event.preventDefault(); recallHistory(1); return }
    if (key === 'ArrowDown' || (ctrl && key.toLowerCase() === 'n')) { event.preventDefault(); recallHistory(-1); return }
    if (ctrl && key.toLowerCase() === 'r') { event.preventDefault(); setDraft(line.value); setSearch({ query: '', skip: 0 }); return }
    if (ctrl && key.toLowerCase() === 'l') { event.preventDefault(); setTranscript([]); return }
    if (ctrl && key.toLowerCase() === 'd') {
      event.preventDefault()
      if (!line.value) { print([{ type: 'command', text: `guest@${profile.host} ${promptPath} % ` }]); ui.exit() } else setLine((current) => applyEdit(current, 'delete-char'))
      return
    }
    if (ghost && (key === 'ArrowRight' || (ctrl && key.toLowerCase() === 'e') || key === 'End') && line.cursor === line.value.length) {
      event.preventDefault(); setValue(line.value + ghost); return
    }
    const plain = !event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey
    const arrowAction = plain ? ({ ArrowLeft: 'backward-char', ArrowRight: 'forward-char', Home: 'beginning-of-line', End: 'end-of-line' } as const)[key as 'Home'] : undefined
    const action = arrowAction ?? bindingFor(event)
    if (action) { event.preventDefault(); setLine((current) => applyEdit(current, action)) }
  }

  const syncCursor = (event: React.SyntheticEvent<HTMLInputElement>) => {
    const cursor = event.currentTarget.selectionStart ?? event.currentTarget.value.length
    setLine((current) => (current.cursor === cursor ? current : { ...current, cursor }))
  }

  const renderLink = ({ href = '', children }: { href?: string; children?: React.ReactNode }) => {
    if (href.startsWith('cmd:')) {
      const command = decodeURIComponent(href.slice(4))
      return <a href={`?cmd=${encodeURIComponent(command)}`} className="cmd-link" onClick={(event) => { event.preventDefault(); if (!busy && !booting) run(command) }}>{children}</a>
    }
    if (href.startsWith('mailto:')) return <a href={href} onClick={(event) => { event.preventDefault(); openExternal(href) }}>{children}</a>
    return <a href={href} target="_blank" rel="noreferrer noopener">{children}</a>
  }

  const renderLine = (item: Line) => {
    if (item.type === 'media' && item.media) {
      const image = <img src={item.media.src} alt={item.media.alt} onLoad={() => { if (!showScrollButton) bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight }) }} />
      return <div key={item.id} className="terminal-line media-line"><span>{item.text}</span>{item.media.href ? <a href={item.media.href} target="_blank" rel="noreferrer noopener">{image}</a> : image}</div>
    }
    if (item.type === 'command') return <div key={item.id} className="terminal-line command">{item.text}</div>
    if (item.type === 'ascii') return <FitPre key={item.id} className="terminal-line ascii">{item.text}</FitPre>
    if (item.type === 'section' && item.section) return <div key={item.id} className="terminal-line rich"><SectionView name={item.section} renderLink={renderLink} /></div>
    if (item.type === 'projects' && item.projects) return <div key={item.id} className="terminal-line rich"><ProjectCards projects={item.projects} detailed={item.detailed} renderLink={renderLink} /></div>
    if (item.type === 'plain') return <pre key={item.id} className="terminal-line plain">{item.text}</pre>
    if (item.type === 'neofetch') return <Neofetch key={item.id} title={item.text} info={item.info ?? []} theme={theme} />
    return (
      <div key={item.id} className={`terminal-line ${item.type}`}>
        <ReactMarkdown remarkPlugins={[remarkGfm]} urlTransform={(url) => (url.startsWith('cmd:') ? url : defaultUrlTransform(url))} components={{ a: renderLink, pre: ({ children }) => <FitPre>{children}</FitPre> }}>{item.text}</ReactMarkdown>
      </div>
    )
  }

  const before = line.value.slice(0, line.cursor)
  const atCursor = line.value[line.cursor] ?? ' '
  const after = line.value.slice(line.cursor + 1)

  return (
    <>
      <div
        className="terminal-body"
        ref={bodyRef}
        onScroll={() => { const body = bodyRef.current; if (body) setShowScrollButton(body.scrollHeight - body.scrollTop - body.clientHeight > 80) }}
        onMouseUp={() => { if (!window.getSelection()?.toString()) inputRef.current?.focus({ preventScroll: true }) }}
        role="log"
        aria-live="polite"
      >
        {transcript.map(renderLine)}
        {booting && <div className="terminal-line muted boot-hint">press any key to skip</div>}
        <div className={`input-row${busy || booting ? ' hidden-row' : ''}`}>
          {search
            ? <span className="prompt search-prompt">(reverse-i-search)`<span className="search-query">{search.query}</span>': </span>
            : <span className="prompt"><span className="prompt-user">guest@{profile.host}</span><span className="prompt-path"> {promptPath}</span><span className="prompt-symbol"> %</span></span>}
          <span className="input-shell">
            <span className="line-render" aria-hidden="true">
              {search
                ? <>{searchMatch ?? ''}<span className="cursor"> </span></>
                : <>{before}<span className="cursor">{atCursor}</span>{after}<span className="completion">{ghost}</span></>}
            </span>
            <input
              ref={inputRef}
              value={search ? search.query : line.value}
              onChange={(event) => { if (!search) setLine((current) => ({ ...current, value: event.target.value, cursor: event.target.selectionStart ?? event.target.value.length })) }}
              onClick={syncCursor}
              onKeyDown={handleKeyDown}
              aria-label="Terminal command input"
              autoCapitalize="off"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="send"
            />
          </span>
        </div>
      </div>
      {showScrollButton && <button className="scroll-to-latest" type="button" onClick={() => { setShowScrollButton(false); bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight, behavior: 'smooth' }); inputRef.current?.focus() }} aria-label="Scroll to latest output">↓</button>}
    </>
  )
})

const neofetchArt = `    ____     ___
   / __ \\   /   |
  / / / /  / /| |  ██
 / /_/ /  / ___ |  ██
/_____/  /_/  |_|  ██`

function Neofetch({ title, info, theme }: { title: string; info: string[]; theme: ThemeName }) {
  const swatches = ['--error', '--success', '--accent', '--link', '--command', '--accent-2', '--muted', '--fg']
  return (
    <div className="terminal-line neofetch">
      <pre className="neofetch-art">{neofetchArt}</pre>
      <div className="neofetch-info">
        <div className="neofetch-title">{title}</div>
        <div className="neofetch-rule">{'─'.repeat(title.length)}</div>
        {info.map((row) => {
          const [key, ...value] = row.split(':')
          return <div key={row}><span className="neofetch-key">{key}</span>:{value.join(':')}</div>
        })}
        <div className="neofetch-swatches" aria-hidden="true">{swatches.map((name) => <span key={name} style={{ background: themes[theme].vars[name] }} />)}</div>
      </div>
    </div>
  )
}
