// One SSH visitor: the same commands as the browser terminal, driven by a
// zsh-style line editor over a raw pty.
import { AsyncLocalStorage } from 'node:async_hooks'
import { StringDecoder } from 'node:string_decoder'
import { askAssistant, fetchProjects, type ChatTurn, type Project } from '../src/api'
import { asciiLogo, motd, os, profile, sshHost } from '../src/content'
import { memoryNoteKeys } from '../src/shell/noteKeys'
import { commandNames, commands, formatProject, neofetchInfo, openTargets, type NewLine, type ShellContext } from '../src/shell/commands'
import { commonPrefix, complete, suggestion } from '../src/shell/completion'
import { applyEdit, bindingFor, expandHistory, reverseSearch, type LineState } from '../src/shell/lineEditor'
import { runInput } from '../src/shell/runner'
import { isThemeName, themeNames, themes, type ThemeName } from '../src/themes'
import { matrix, snake, twenty48, viewer, type App, type Screen } from './apps'
import { hyperlink, palette, renderMarkdown, RESET, width, wrap, type Palette } from './ansi'
import { hasImage, renderImage } from './images'
import { applyProbe, detect, parseKeys, probeDone, probeQuery, stripProbeReplies, type Graphics, type Key } from './terminal'

export type Io = { write: (data: string) => void; close: () => void }
export type SessionOptions = { ip: string; columns: number; rows: number; term: string; env: Record<string, string>; io: Io; idleMs?: number; maxMs?: number; probeMs?: number }

// The visitor behind the current command, for the API calls it makes.
export const visitor = new AsyncLocalStorage<Session>()

const clampSize = (value: number, fallback: number, min: number, max: number) => (value > 0 ? Math.max(min, Math.min(max, Math.floor(value))) : fallback)
const frames = '⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏'
const maxLine = 1000
const commandsPerMinute = 40
const maxInputBytes = 256 * 1024
const inputWindowMs = 10_000
const maxResizesPerSecond = 20
export const defaultTheme: ThemeName = isThemeName('golden') ? 'golden' : themeNames[0]!

export class Session {
  readonly ip: string
  columns: number
  rows: number
  graphics: Graphics
  theme: ThemeName = defaultTheme
  private colors: Palette
  private io: Io
  private decoder = new StringDecoder('utf8')
  private mode: 'probe' | 'line' | 'busy' | 'question' | 'app' | 'closed' = 'probe'
  private probeBuffer = ''
  private line: LineState = { value: '', cursor: 0, killRing: '' }
  private cursorRow = 0
  // The prompt already on screen, so a one-row edit can skip redrawing it.
  private drawnPrompt = ''
  private path = '~'
  private previousPath = '~'
  private history: string[] = []
  private historyIndex = -1
  private draft = ''
  private search: { query: string; skip: number } | null = null
  private lastTab = 0
  private question: { label: string; resolve: (answer: string | null) => void } | null = null
  private app: App | null = null
  private abort: AbortController | null = null
  private chat: ChatTurn[] = []
  private notes = memoryNoteKeys()
  private projectNames: string[] = []
  private recent: number[] = []
  // Raw bytes received in the current window: blunts keystroke floods and the
  // output amplification a stream of control characters would cause.
  private inputBytes = 0
  private inputWindowAt = Date.now()
  private resizes: number[] = []
  private timers: NodeJS.Timeout[] = []
  private idle: NodeJS.Timeout | undefined
  private idleMs: number

  constructor(options: SessionOptions) {
    this.ip = options.ip
    this.columns = clampSize(options.columns, 80, 20, 400)
    this.rows = clampSize(options.rows, 24, 5, 200)
    this.io = options.io
    this.graphics = detect(options.term, options.env)
    this.colors = palette(themes[this.theme]!.colors, this.graphics.color)
    this.idleMs = options.idleMs ?? 10 * 60_000
    this.timers.push(setTimeout(() => this.close('This session has reached its one hour limit. Thanks for visiting!'), options.maxMs ?? 60 * 60_000))
    this.touch()
    this.write(probeQuery)
    this.timers.push(setTimeout(() => this.finishProbe(), options.probeMs ?? 600))
  }

  get closed() { return this.mode === 'closed' }

  // ---- output ----

  private write(data: string) { if (this.mode !== 'closed') this.io.write(data) }
  private writeLines(lines: string[]) { if (lines.length) this.write(lines.map((line) => `${line}\r\n`).join('')) }

  private screen(): Screen {
    return { columns: this.columns, rows: this.rows, palette: this.colors, depth: this.graphics.color, write: (data) => this.write(data) }
  }

  private markdown(text: string, base = '') {
    return renderMarkdown(text, { columns: this.columns, palette: this.colors, base, hyperlinks: this.graphics.hyperlinks })
  }

  render(line: NewLine): string[] {
    const colors = this.colors
    switch (line.type) {
      case 'command': return [line.text]
      case 'error': return this.markdown(line.text, colors.error)
      case 'muted': return this.markdown(line.text, colors.muted)
      case 'success': return this.markdown(line.text, colors.success)
      case 'plain': return line.text.split('\n').flatMap((item) => wrap(item, this.columns))
      case 'ascii': return line.text.split('\n').map((item) => colors.accent + item + RESET)
      case 'neofetch': return [`${colors.heading}${line.text}${RESET}`, colors.muted + '─'.repeat(Math.min(this.columns, width(line.text))) + RESET, ...(line.info ?? []).map((row) => row.replace(/^([^:]+:)/, `${colors.accent}$1${RESET}`))]
      case 'media': return []
      default: return this.markdown(line.text)
    }
  }

  print(lines: NewLine[]) {
    for (const line of lines.map(sshEdition)) {
      if (line.type === 'media' && line.media) { this.showImage(line.media.src, line.media.alt, line.media.href); continue }
      if (line.type === 'projects' && line.projects?.length) { this.showProjects(line.projects, Boolean(line.detailed)); continue }
      this.writeLines(this.render(line))
    }
  }

  private showImage(src: string, alt: string, href?: string) {
    const url = `${profile.website}${src}`
    const image = hasImage(src) ? renderImage(src, this.graphics.images, this.columns, this.graphics.color, this.graphics.multipart) : null
    if (image) this.write(image)
    else this.writeLines(this.markdown(`*${alt}*`, this.colors.muted))
    const link = href ?? url
    this.writeLines([`${this.colors.muted}${alt} · ${RESET}${this.colors.link}${hyperlink(link, link, this.graphics.hyperlinks)}${RESET}`])
    if (image && !['kitty', 'iterm', 'sixel'].includes(this.graphics.images)) this.writeLines([`${this.colors.muted}Sharper images: \`graphics kitty\`, \`graphics iterm\` or \`graphics sixel\` if your terminal supports them.${RESET}`.replace(/`([^`]+)`/g, `${this.colors.command}$1${RESET}${this.colors.muted}`)])
  }

  // Each project's share image above its summary, as on the site: thumbnails in
  // the list, full width for a single project.
  private showProjects(projects: Project[], detailed: boolean) {
    projects.forEach((project, index) => {
      if (index) this.write('\r\n')
      const image = project.image && hasImage(project.image) ? renderImage(project.image, this.graphics.images, this.columns, this.graphics.color, this.graphics.multipart, !detailed) : null
      if (image) this.write(image)
      this.writeLines(this.markdown(formatProject(project, detailed)))
    })
  }

  clear() { this.write('\x1b[H\x1b[2J\x1b[3J') }

  // OSC 52 asks the visitor's terminal to put text on their clipboard.
  copy(text: string) { this.write(`\x1b]52;c;${Buffer.from(text).toString('base64')}\x07`) }

  setTheme(name: ThemeName) {
    this.theme = name
    this.colors = palette(themes[name]!.colors, this.graphics.color)
  }

  setGraphics(next: Partial<Graphics>) {
    this.graphics = { ...this.graphics, ...next }
    this.colors = palette(themes[this.theme]!.colors, this.graphics.color)
  }

  banner() {
    const logo = asciiLogo.split('\n')
    if (asciiLogo && Math.max(...logo.map(width)) <= this.columns) this.writeLines(['', ...logo.map((line) => this.colors.accent + line + RESET)])
    else this.writeLines(['', `${this.colors.heading}${profile.name}${RESET}`])
    this.print([
      { type: 'neofetch', text: `${profile.handle}@${profile.host}`, info: neofetchInfo(this.theme) },
      { type: 'output', text: `\nWelcome to **${os.name} ${os.version}**, over real SSH this time.` },
      { type: 'muted', text: [profile.title, ...motd, `Last login: ${new Date().toUTCString()} from ${this.ip}`].filter(Boolean).map((item) => `  • ${item}`).join('\n') },
      { type: 'success', text: 'Type [`help`](cmd:help) to explore, [`projects`](cmd:projects) for my GitHub, or just ask a question in plain English.' },
      { type: 'muted', text: `The browser version, with a desktop and windows: ${profile.website}` },
    ])
  }

  // ---- prompt and line editor ----

  private promptText(): string {
    if (this.search) return `${this.colors.muted}(reverse-i-search)\`${RESET}${this.search.query}${this.colors.muted}': ${RESET}`
    if (this.mode === 'question' && this.question) return `${this.colors.accent}${this.question.label}${RESET}`
    return `${this.colors.success}guest@${profile.host}${RESET} ${this.colors.accent}${this.path === '~' ? '~' : `~/${this.path}`}${RESET} % `
  }

  private ghost(): string {
    if (this.search || this.mode !== 'line' || this.line.cursor !== this.line.value.length) return ''
    return suggestion(this.line.value, this.history, this.path, this.projectNames, themeNames)
  }

  // Multi-line aware redraw (the linenoise approach): go back to the first row,
  // clear down, write prompt and line, then park the cursor.
  private refresh(withGhost = true) {
    if (this.mode !== 'line' && this.mode !== 'question') return
    const prompt = this.promptText()
    const value = this.search ? reverseSearch(this.history, this.search.query, this.search.skip) ?? '' : this.line.value
    const ghost = withGhost ? this.ghost() : ''
    const promptWidth = width(prompt)
    const columns = Math.max(10, this.columns)
    const end = promptWidth + width(value) + width(ghost)
    const tail = value + (ghost ? `${this.colors.muted}${ghost}${RESET}` : '')
    const cursorAt = this.search ? promptWidth + width(value) : promptWidth + width(this.line.value.slice(0, this.line.cursor))
    if (this.cursorRow === 0 && this.drawnPrompt === prompt && end < columns) {
      this.write(`\r\x1b[${promptWidth}C${tail}\x1b[K\r\x1b[${cursorAt}C`)
      return
    }
    let output = (this.cursorRow > 0 ? `\x1b[${this.cursorRow}A` : '') + '\r\x1b[J' + prompt + tail
    if (end > 0 && end % columns === 0) output += '\r\n'
    const endRow = Math.floor(end / columns)
    const cursor = this.search ? promptWidth + width(value) : promptWidth + width(this.line.value.slice(0, this.line.cursor))
    const cursorRow = Math.floor(cursor / columns)
    const cursorColumn = cursor % columns
    if (endRow > cursorRow) output += `\x1b[${endRow - cursorRow}A`
    output += `\r${cursorColumn ? `\x1b[${cursorColumn}C` : ''}`
    this.cursorRow = cursorRow
    this.drawnPrompt = prompt
    this.write(output)
  }

  private showPrompt() {
    this.mode = 'line'
    this.line = { value: '', cursor: 0, killRing: this.line.killRing }
    this.cursorRow = 0; this.drawnPrompt = ''
    this.historyIndex = -1
    this.refresh()
  }

  // Leaves the cursor below the finished line.
  private commitLine() {
    const cursor = { ...this.line }
    this.line = { ...this.line, cursor: this.line.value.length }
    this.refresh(false)
    this.line = cursor
    this.write('\r\n')
    this.cursorRow = 0; this.drawnPrompt = ''
  }

  private setLine(value: string, cursor = value.length) {
    this.line = { ...this.line, value: value.slice(0, maxLine), cursor: Math.min(cursor, maxLine) }
    this.refresh()
  }

  private insert(text: string) {
    // Pasted newlines become spaces; other control characters are dropped.
    const clean = text.replace(/\r\n?|\n|\t/g, ' ').replace(/[\x00-\x1f\x7f]/g, '')
    if (!clean) return
    const { value, cursor } = this.line
    const next = value.slice(0, cursor) + clean + value.slice(cursor)
    // Typing at the end of the line just echoes, unless a suggestion or a wrap needs a redraw.
    const echo = this.mode === 'line' && !this.search && cursor === value.length && next.length <= maxLine && !this.ghost() && !/[^\x20-\x7e]/.test(clean)
    if (echo) {
      this.line = { ...this.line, value: next, cursor: next.length }
      const end = width(this.promptText()) + next.length
      if (!this.ghost() && Math.floor((end - 1) / this.columns) === Math.floor((end - clean.length) / this.columns) && end % this.columns !== 0) { this.write(clean); return }
      this.line = { ...this.line, value, cursor }
    }
    this.setLine(next, cursor + clean.length)
  }

  private walkHistory(direction: 1 | -1) {
    if (!this.history.length) return
    if (this.historyIndex === -1) this.draft = this.line.value
    const index = Math.max(-1, Math.min(this.history.length - 1, this.historyIndex + direction))
    this.historyIndex = index
    this.setLine(index === -1 ? this.draft : this.history[this.history.length - 1 - index]!)
  }

  private tab() {
    const { prefix, fragment, candidates } = complete(this.line.value, this.path, this.projectNames, themeNames)
    if (!candidates.length) { this.write('\x07'); return }
    if (candidates.length === 1) { const [only] = candidates as [string]; this.setLine(prefix + only + (only.endsWith('/') ? '' : ' ')); return }
    const common = commonPrefix(candidates)
    if (common.length > fragment.length) { this.setLine(prefix + common); return }
    const now = Date.now()
    if (now - this.lastTab < 800) {
      this.commitLine()
      const cell = Math.max(...candidates.map((item) => width(item))) + 2
      const perRow = Math.max(1, Math.floor(this.columns / cell))
      const rows: string[] = []
      for (let index = 0; index < candidates.length; index += perRow) rows.push(candidates.slice(index, index + perRow).map((item) => item.padEnd(cell)).join('').trimEnd())
      this.writeLines(rows)
      this.cursorRow = 0; this.drawnPrompt = ''
      this.refresh()
    } else this.write('\x07')
    this.lastTab = now
  }

  private searchKey(key: Key) {
    const search = this.search!
    if (key.ctrl && key.name === 'r') { this.search = { ...search, skip: search.skip + 1 }; this.refresh(); return }
    if (key.name === 'backspace') { this.search = { query: search.query.slice(0, -1), skip: 0 }; this.refresh(); return }
    if ((key.ctrl && (key.name === 'c' || key.name === 'g')) || key.name === 'escape') { this.search = null; this.refresh(); return }
    if (key.text && !key.ctrl && !key.alt) { this.search = { query: search.query + key.text, skip: 0 }; this.refresh(); return }
    const match = reverseSearch(this.history, search.query, search.skip) ?? this.line.value
    this.search = null
    this.line = { ...this.line, value: match, cursor: match.length }
    if (key.name === 'enter') { void this.submit(); return }
    this.refresh()
  }

  private lineKey(key: Key) {
    if (this.search) { this.searchKey(key); return }
    const { value, cursor } = this.line
    if (key.name === 'paste') { this.insert(key.text ?? ''); return }
    if (key.name === 'enter') { void this.submit(); return }
    if (key.ctrl) {
      switch (key.name) {
        case 'c':
          this.commitLine()
          this.write(`${this.colors.muted}^C${RESET}\r\n`)
          if (this.mode === 'question') { this.answer(null); return }
          this.showPrompt()
          return
        case 'd':
          if (!value) { if (this.mode === 'question') { this.commitLine(); this.answer(null) } else { this.commitLine(); this.close('logout') } return }
          this.setLine(value.slice(0, cursor) + value.slice(cursor + 1), cursor)
          return
        case 'l': this.clear(); this.cursorRow = 0; this.drawnPrompt = ''; this.refresh(); return
        case 'r': if (this.mode === 'line') { this.search = { query: '', skip: 0 }; this.refresh() } return
        case 'p': this.walkHistory(1); return
        case 'n': this.walkHistory(-1); return
        case 'e': if (cursor === value.length) { const ghost = this.ghost(); if (ghost) { this.setLine(value + ghost); return } } break
        case 'f': if (cursor === value.length) { const ghost = this.ghost(); if (ghost) { this.setLine(value + ghost); return } } break
      }
    }
    if (!key.ctrl && !key.alt) {
      switch (key.name) {
        case 'tab': if (this.mode === 'line') this.tab(); return
        case 'backspace': if (cursor > 0) this.setLine(value.slice(0, cursor - 1) + value.slice(cursor), cursor - 1); return
        case 'delete': this.setLine(value.slice(0, cursor) + value.slice(cursor + 1), cursor); return
        case 'left': this.setLine(value, Math.max(0, cursor - 1)); return
        case 'right': {
          const ghost = this.ghost()
          if (cursor === value.length && ghost) this.setLine(value + ghost)
          else this.setLine(value, Math.min(value.length, cursor + 1))
          return
        }
        case 'home': this.setLine(value, 0); return
        case 'end': this.setLine(value, value.length); return
        case 'up': this.walkHistory(1); return
        case 'down': this.walkHistory(-1); return
      }
    }
    const codes: Record<string, string> = { b: 'KeyB', f: 'KeyF', d: 'KeyD', backspace: 'Backspace', left: 'ArrowLeft', right: 'ArrowRight' }
    const action = bindingFor({ key: key.name, code: codes[key.name] ?? '', ctrlKey: Boolean(key.ctrl), altKey: Boolean(key.alt), metaKey: false })
    if (action) { this.line = applyEdit(this.line, action); this.refresh(); return }
    if (key.text && !key.ctrl && !key.alt) this.insert(key.text)
  }

  private answer(value: string | null) {
    const question = this.question
    this.question = null
    this.mode = 'busy'
    question?.resolve(value)
  }

  // ---- running commands ----

  private allowCommand(): boolean {
    const now = Date.now()
    this.recent = this.recent.filter((time) => now - time < 60_000)
    if (this.recent.length >= commandsPerMinute) return false
    this.recent.push(now)
    return true
  }

  private async submit() {
    const input = this.line.value
    this.commitLine()
    if (this.mode === 'question') { this.answer(input); return }
    const trimmed = input.trim()
    if (!trimmed) { this.showPrompt(); return }
    if (!this.allowCommand()) { this.print([{ type: 'error', text: 'slow down a little: too many commands this minute' }]); this.showPrompt(); return }
    const { value, error } = expandHistory(trimmed, this.history)
    if (error) { this.print([{ type: 'error', text: error }]); this.showPrompt(); return }
    if (value !== trimmed) this.print([{ type: 'muted', text: value }])
    if (this.history.at(-1) !== value) this.history = [...this.history, value].slice(-200)
    this.mode = 'busy'
    try {
      await visitor.run(this, async () => {
        for (const part of value.split(/\s*(?:&&|;)\s*/).filter(Boolean)) {
          if (this.mode === 'closed') return
          await runInput(part, this.context())
        }
      })
    } catch (failure) {
      this.print([{ type: 'error', text: failure instanceof Error ? failure.message : 'something went wrong' }])
    } finally {
      if (this.mode === 'busy') this.showPrompt()
    }
  }

  private async ask(question: string) {
    const controller = new AbortController()
    this.abort = controller
    let frame = 0
    this.write(`${this.colors.muted}${frames[0]} thinking ...${RESET}`)
    // Only the spinner glyph changes, a few times a second, to keep terminal triggers cheap.
    const spinner = setInterval(() => this.write(`\r${this.colors.muted}${frames[++frame % frames.length]}${RESET}`), 150)
    try {
      const turns: ChatTurn[] = [...this.chat.slice(-6), { role: 'user', content: question }]
      const { reply, blocked } = await askAssistant(turns, controller.signal)
      if (!blocked) this.chat = [...turns, { role: 'assistant', content: reply }]
      clearInterval(spinner)
      this.write('\r\x1b[K')
      this.print([{ type: 'assistant', text: reply }])
    } catch (error) {
      clearInterval(spinner)
      this.write('\r\x1b[K')
      if (controller.signal.aborted) this.print([{ type: 'muted', text: '^C' }])
      else this.print([{ type: 'error', text: `assistant: ${error instanceof Error ? error.message : 'unavailable right now'}. Try \`help\` for built-in commands.` }])
    } finally {
      clearInterval(spinner)
      this.abort = null
    }
  }

  private projects = async (): Promise<Project[]> => {
    const list = await fetchProjects()
    this.projectNames = list.map((project) => project.name)
    return list
  }

  private startApp(create: (screen: Screen, onExit: () => void) => App) {
    this.mode = 'app'
    this.app = create(this.screen(), () => {
      this.app = null
      if (this.mode === 'app') this.showPrompt()
    })
  }

  context(): ShellContext {
    const muted = (text: string) => this.print([{ type: 'muted', text }])
    return {
      path: this.path,
      previousPath: this.previousPath,
      columns: this.columns,
      history: this.history,
      theme: this.theme,
      setPath: (next) => { this.previousPath = this.path; this.path = next },
      print: (lines) => this.print(lines),
      clear: () => this.clear(),
      projects: this.projects,
      ask: (question) => this.ask(question),
      notes: this.notes,
      prompt: (label) => new Promise<string | null>((resolve) => {
        this.question = { label, resolve }
        this.mode = 'question'
        this.line = { value: '', cursor: 0, killRing: this.line.killRing }
        this.cursorRow = 0; this.drawnPrompt = ''
        this.refresh()
      }),
      ui: {
        setTheme: (name) => this.setTheme(name),
        toggleMaximize: () => muted('Over SSH your terminal is the window: resize it and the text reflows.'),
        toggleFullscreen: () => muted('Over SSH your terminal is the window: resize it and the text reflows.'),
        exit: () => this.close('logout'),
        matrix: () => this.startApp(matrix),
        replayBoot: () => this.banner(),
        setCrt: () => {},
        crt: false,
        game: (name) => this.startApp(name === 'snake' ? snake : twenty48),
        vim: (file, text) => this.startApp((screen, onExit) => viewer(screen, file, text, onExit)),
        meltdown: () => {},
        openBrowser: (url) => this.print([{ type: 'output', text: `Open it in your browser: [${url ?? `${profile.website}/gui`}](${url ?? `${profile.website}/gui`})` }]),
      },
    }
  }

  // ---- input ----

  private touch() {
    clearTimeout(this.idle)
    this.idle = setTimeout(() => this.close(`Idle for ${Math.round(this.idleMs / 60_000)} minutes, closing the connection. Come back anytime!`), this.idleMs)
  }

  private finishProbe() {
    if (this.mode !== 'probe') return
    this.graphics = applyProbe(this.graphics, this.probeBuffer)
    this.colors = palette(themes[this.theme]!.colors, this.graphics.color)
    const typed = stripProbeReplies(this.probeBuffer)
    this.probeBuffer = ''
    // Bracketed paste lets a pasted multi-line block arrive as one edit.
    this.write('\x1b[?2004h')
    this.banner()
    this.mode = 'line'
    this.showPrompt()
    void visitor.run(this, () => this.projects().catch(() => {}))
    if (typed) this.input(typed)
  }

  input(data: Buffer | string) {
    if (this.mode === 'closed') return
    // A human never sends anywhere near this; a flood or paste bomb does.
    const now = Date.now()
    if (now - this.inputWindowAt > inputWindowMs) { this.inputWindowAt = now; this.inputBytes = 0 }
    this.inputBytes += data.length
    if (this.inputBytes > maxInputBytes) { this.close('Too much input too quickly, closing the connection.'); return }
    this.touch()
    const text = typeof data === 'string' ? data : this.decoder.write(data)
    if (this.mode === 'probe') {
      this.probeBuffer += text
      if (probeDone(this.probeBuffer)) this.finishProbe()
      return
    }
    for (const key of parseKeys(text)) {
      if (this.closed) return
      if (this.mode === 'app') { this.app?.key(key); continue }
      if (this.mode === 'busy') { if (key.ctrl && key.name === 'c') this.abort?.abort(); continue }
      this.lineKey(key)
    }
  }

  resize(columns: number, rows: number) {
    this.columns = clampSize(columns, this.columns, 20, 400)
    this.rows = clampSize(rows, this.rows, 5, 200)
    // The new size is always kept; only the redraw is dropped when a client
    // spams window-change, so resize floods can't amplify into output.
    const now = Date.now()
    this.resizes = this.resizes.filter((time) => now - time < 1000)
    this.resizes.push(now)
    if (this.resizes.length > maxResizesPerSecond) return
    if (this.mode === 'app') this.app?.resize()
    else if (this.mode === 'line' || this.mode === 'question') this.refresh()
  }

  close(message?: string) {
    if (this.mode === 'closed') return
    this.app?.stop()
    this.abort?.abort()
    this.question?.resolve(null)
    if (message) this.write(`\r\n${this.colors.muted}${message}${RESET}\r\n`)
    this.write('\x1b[?2004l')
    this.mode = 'closed'
    clearTimeout(this.idle)
    for (const timer of this.timers) clearTimeout(timer)
    this.io.close()
  }
}

// Text from the API (assistant replies, guestbook notes, READMEs) must not
// carry its own escape sequences into the visitor's terminal.
const controls = /[\u0000-\u0008\u000b-\u001f\u007f-\u009f]/g
const safe = (text: string) => text.replace(controls, '')

// Lines written for the browser, adjusted for a visitor who is already on SSH.
function sshEdition(raw: NewLine): NewLine {
  const line = { ...raw, text: safe(raw.text), info: raw.info?.map(safe) }
  if (line.type === 'neofetch') return { ...line, info: line.info?.map((row) => row.replace(/^Shell:(\s*).*/, 'Shell:$1zsh (SSH edition)').replace(/^Kernel:(\s*).*/, `Kernel:$1Node.js ${process.versions.node} + ssh2`)) }
  if (line.type === 'muted' && sshHost && line.text.includes(`ssh ${sshHost}`)) return { ...line, text: `You are on the SSH edition. The browser one has a desktop and windows: ${profile.website}` }
  return line
}

// Commands that would open a browser tab print a link instead.
const link = (url: string) => `[${url.replace(/^mailto:/, '')}](${url})`
const absolute = (url: string) => (url.startsWith('/') ? `${profile.website}${url}` : url)
commands.resume = { ...commands.resume!, summary: 'link to my resume (PDF)', run: (_args, ctx) => ctx.print([{ type: 'success', text: `Resume (PDF): ${link(absolute(profile.resume))}` }]) }
commands.email = { ...commands.email!, summary: 'my email address', run: (_args, ctx) => ctx.print([{ type: 'output', text: `Email me at ${link(`mailto:${profile.email}`)}` }]) }
commands.gui = { ...commands.gui!, summary: 'link to the standard portfolio website', run: (_args, ctx) => ctx.ui.openBrowser(`${profile.website}/gui`) }
commands.crt = { ...commands.crt!, hidden: true, run: (_args, ctx) => ctx.print([{ type: 'muted', text: `CRT scanlines need the browser: ${profile.website}/?cmd=crt` }]) }
commands.maximize = { ...commands.maximize!, hidden: true }
commands.fullscreen = { ...commands.fullscreen!, hidden: true }
commands.ssh = { ...commands.ssh!, hidden: true, run: (_args, ctx) => ctx.print([{ type: 'muted', text: 'You are already here, over real SSH this time.' }]) }
const openTarget = commands.open!
commands.open = { ...openTarget, summary: 'link to a project, github, linkedin or the source', run: async (args, ctx) => {
  const target = (args[0] ?? '').toLowerCase()
  const known = Object.fromEntries(Object.entries(openTargets()).map(([key, url]) => [key, absolute(url)]))
  if (known[target]) { ctx.print([{ type: 'output', text: link(known[target]!) }]); return }
  try {
    const project = (await ctx.projects()).find((item) => item.name.toLowerCase() === target)
    if (project) { ctx.print([{ type: 'output', text: link(project.url) }]); return }
  } catch { /* fall through to the error below */ }
  ctx.print([{ type: 'error', text: `open: ${args[0] ?? ''}: unknown target. Try ${Object.keys(known).filter((key) => key !== 'email').join(', ')} or a project name.` }])
} }
commands.share = { ...commands.share!, run: (args, ctx) => {
  const command = args.join(' ') || [...ctx.history].reverse().find((item) => !item.startsWith('share')) || 'help'
  const url = `${profile.website}/?cmd=${encodeURIComponent(command)}`
  visitor.getStore()?.copy(url)
  ctx.print([{ type: 'output', text: link(url) }, { type: 'muted', text: 'sent to your clipboard, if your terminal allows it (OSC 52)' }])
} }
commands.graphics = { group: 'Terminal', summary: 'how images and colours are drawn here', usage: 'graphics [kitty|iterm|sixel|blocks|ascii] [truecolor|256|16]', run: (args, ctx) => {
  const session = visitor.getStore()
  if (!session) return
  for (const arg of args) {
    if (['kitty', 'iterm', 'sixel', 'blocks', 'ascii'].includes(arg)) session.setGraphics({ images: arg as Graphics['images'] })
    else if (['truecolor', '256', '16'].includes(arg)) session.setGraphics({ color: arg as Graphics['color'] })
    else if (arg === 'links' || arg === 'nolinks') session.setGraphics({ hyperlinks: arg === 'links' })
    else { ctx.print([{ type: 'error', text: `graphics: unknown option '${arg}'` }]); return }
  }
  const { images, color, hyperlinks } = session.graphics
  ctx.print([{ type: 'output', text: `images **${images}** · colours **${color}** · hyperlinks **${hyperlinks ? 'on' : 'off'}**` }, { type: 'muted', text: 'Detected from your terminal at login. Change with e.g. `graphics sixel` or `graphics blocks 256`, then try `view architecture.svg`.' }])
} }
commandNames.push('graphics')
commandNames.sort()
