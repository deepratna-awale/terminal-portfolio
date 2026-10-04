import { afterEach, describe, expect, it } from 'vitest'
import { parseColor, renderMarkdown, stripAnsi, to256, width, wrap, palette } from './ansi'
import { ascii, scale } from './images'
import { Session } from './session'
import { applyProbe, detect, parseKeys } from './terminal'

const colors = palette({ background: '#000', surface: '#111', foreground: '#eee', muted: '#777', accent: '#f3b95e' }, 'truecolor')
const plain = (lines: string[]) => lines.map(stripAnsi)

describe('colours', () => {
  it('reads the CSS forms theme files use', () => {
    expect(parseColor('#f3b95e')).toEqual([243, 185, 94])
    expect(parseColor('#fff')).toEqual([255, 255, 255])
    expect(parseColor('rgb(10, 20, 30)')).toEqual([10, 20, 30])
    expect(parseColor('hsl(0 100% 50%)')).toEqual([255, 0, 0])
    expect(parseColor('oklch(1 0 0)')).toEqual([255, 255, 255])
    expect(parseColor('color-mix(in srgb, #ffffff 50%, #000000)')).toEqual([128, 128, 128])
    expect(parseColor('nonsense')).toBeNull()
  })

  it('maps to the 256-colour palette', () => {
    expect(to256([255, 0, 0])).toBe(196)
    expect(to256([128, 128, 128])).toBe(244)
  })
})

describe('text layout', () => {
  it('measures visible width', () => {
    expect(width('\x1b[1mhi\x1b[0m')).toBe(2)
    expect(width('日本')).toBe(4)
  })

  it('wraps on words with a hanging indent', () => {
    expect(plain(wrap('one two three four five', 10, '  '))).toEqual(['one two', '  three', '  four', '  five'])
    expect(plain(wrap('abcdefghijklmnop', 10))).toEqual(['abcdefghij', 'klmnop'])
  })

  it('renders headings, bullets, links and command hints', () => {
    const lines = plain(renderMarkdown('# Title\n- a [site](https://example.dev) and [`help`](cmd:help)\n[screenshot](cmd:view%20screenshots%2Frepo)', { columns: 80, palette: colors, hyperlinks: false }))
    expect(lines).toEqual(['Title', '  • a site <https://example.dev> and help', 'screenshot (view screenshots/repo)'])
  })

  it('folds tables that do not fit', () => {
    const table = '| Name | Note |\n| --- | --- |\n| a | ' + 'long '.repeat(30) + '|'
    expect(plain(renderMarkdown(table, { columns: 40, palette: colors, hyperlinks: false }))[0]).toMatch(/^Name: a/)
  })
})

describe('terminal input and detection', () => {
  it('parses keys, modifiers and pastes', () => {
    expect(parseKeys('a\x1b[A\x03\x1bb\x1b[1;3D\r').map((key) => [key.name, Boolean(key.ctrl), Boolean(key.alt)])).toEqual([['a', false, false], ['up', false, false], ['c', true, false], ['b', false, true], ['left', false, true], ['enter', false, false]])
    expect(parseKeys('\x1b[200~two\nlines\x1b[201~')).toEqual([{ name: 'paste', text: 'two\nlines' }])
  })

  it('guesses from TERM and confirms with the probe', () => {
    expect(detect('xterm-kitty', {}).images).toBe('kitty')
    expect(detect('xterm-256color', { LC_TERMINAL: 'iTerm2' }).images).toBe('iterm')
    expect(detect('vt100', {})).toMatchObject({ images: 'ascii', color: '16' })
    const base = detect('xterm-256color', {})
    expect(applyProbe(base, '\x1b_Gi=31;OK\x1b\\\x1b[?62;c').images).toBe('kitty')
    expect(applyProbe(base, '\x1b[?62;4;22c').images).toBe('sixel')
    expect(applyProbe(base, '\x1bP>|WezTerm 2024\x1b\\\x1b[?62;4c').images).toBe('iterm')
    expect(applyProbe(base, '\x1bP>|tmux 3.4\x1b\\\x1b[?62;4c').images).toBe('blocks')
    expect(applyProbe(base, '\x1bP>|iTerm2 3.7.3\x1b\\\x1b[?62;4c')).toMatchObject({ images: 'iterm', multipart: true })
    expect(detect('xterm-256color', { LC_TERMINAL: 'iTerm2', LC_TERMINAL_VERSION: '3.4.19' }).multipart).toBe(false)
  })
})

describe('images', () => {
  it('scales a grid and draws ASCII', () => {
    const grid = { width: 4, height: 4, data: new Uint8Array(48).fill(255) }
    const small = scale(grid, 2, 1)
    expect(small.width).toBe(2)
    expect(ascii(small)[0]).toBe('@@')
  })
})

describe('session', () => {
  let session: Session | undefined
  afterEach(() => session?.close())

  const start = () => {
    let output = ''
    let closed = false
    session = new Session({ ip: '198.51.100.1', columns: 100, rows: 30, term: 'xterm-256color', env: {}, probeMs: 10_000, io: { write: (data) => { output += data }, close: () => { closed = true } } })
    session.input('\x1b[?62;22c')
    return { read: () => stripAnsi(output), clear: () => { output = '' }, closed: () => closed }
  }

  it('greets, runs commands and edits the line', async () => {
    const terminal = start()
    expect(terminal.read()).toContain('over real SSH')
    terminal.clear()
    session!.input('hlep\x02\x02\x14\r')
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(terminal.read()).toContain('Portfolio')
    terminal.clear()
    session!.input('cat contact | grep -i email\r')
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(terminal.read()).toMatch(/email/)
  })

  it('drops escape sequences from fetched text', () => {
    let output = ''
    session = new Session({ ip: '198.51.100.1', columns: 80, rows: 24, term: 'xterm-256color', env: {}, probeMs: 10_000, io: { write: (data) => { output += data }, close: () => {} } })
    output = ''
    session.print([{ type: 'plain', text: 'hi\x1b]52;c;cHduZWQ=\x07 there' }])
    expect(output).not.toContain('\x1b]52')
    expect(stripAnsi(output)).toContain('hi]52;c;cHduZWQ= there')
  })

  it('logs out on exit and ^D', async () => {
    const terminal = start()
    session!.input('\x04')
    expect(terminal.closed()).toBe(true)
  })
})

describe('abuse resistance', () => {
  const build = () => {
    let output = ''
    let closed = false
    const session = new Session({ ip: '198.51.100.2', columns: 80, rows: 24, term: 'xterm-256color', env: {}, probeMs: 10_000, io: { write: (data) => { output += data }, close: () => { closed = true } } })
    session.input('\x1b[?62;22c')
    return { session, read: () => stripAnsi(output), closed: () => closed }
  }

  it('closes a connection that floods it with input', () => {
    const t = build()
    t.session.input('x'.repeat(300_000))
    expect(t.closed()).toBe(true)
    expect(t.read()).toContain('Too much input')
  })

  it('does not crash on malformed escape sequences', () => {
    const t = build()
    expect(() => t.session.input('\x1b[\x1b[?999;999H\x1b]evil\x9b\x9c\x90\x00\x07\x7f\xff\xfe')).not.toThrow()
    expect(t.closed()).toBe(false)
    t.session.close()
  })

  it('survives a resize storm and keeps working', async () => {
    const t = build()
    for (let i = 0; i < 300; i++) t.session.resize(60 + (i % 50), 20 + (i % 30))
    expect(() => t.session.resize(100, 30)).not.toThrow()
    t.session.input('help\r')
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(t.read()).toContain('Portfolio')
    expect(t.closed()).toBe(false)
    t.session.close()
  })

  it('still accepts a normal pasted command', async () => {
    const t = build()
    t.session.input('\x1b[200~about\x1b[201~\r')
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(t.closed()).toBe(false)
    t.session.close()
  })
})

describe('project images', () => {
  it('draws a thumbnail above each project in the list', async () => {
    const { mkdtempSync, writeFileSync } = await import('node:fs')
    const { tmpdir } = await import('node:os')
    const { join } = await import('node:path')
    const { setImageDirectory } = await import('./images')
    const dir = mkdtempSync(join(tmpdir(), 'ssh-images-'))
    writeFileSync(join(dir, 'manifest.json'), JSON.stringify({ '/media/projects/demo.jpg': { png: 'demo.png', width: 4, height: 2, sixel: 'demo.six', grid: { file: 'demo.rgb', width: 4, height: 2 } } }))
    writeFileSync(join(dir, 'demo.rgb'), Buffer.alloc(24, 200))
    setImageDirectory(dir)
    let output = ''
    const session = new Session({ ip: '198.51.100.1', columns: 80, rows: 24, term: 'xterm-256color', env: {}, probeMs: 10_000, io: { write: (data) => { output += data }, close: () => {} } })
    output = ''
    const project = { name: 'demo', description: 'A demo', language: 'Go', stars: 0, url: 'https://github.com/x/demo', homepage: null, image: '/media/projects/demo.jpg', pushedAt: new Date().toISOString(), bullets: ['Does a thing'] }
    session.print([{ type: 'projects', text: '', projects: [project, { ...project, name: 'other', image: null }] }])
    const text = stripAnsi(output)
    expect(text.indexOf('▀')).toBeLessThan(text.indexOf('demo'))
    expect(text).toContain('other')
    session.close()
    setImageDirectory('')
  })
})
