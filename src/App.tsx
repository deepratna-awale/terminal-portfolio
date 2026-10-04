import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent } from 'react'
import './App.css'
import { BrowserWindow, type BrowserControls } from './components/Browser'
import { GameOverlay, type GameName } from './components/Games'
import { MatrixRain } from './components/MatrixRain'
import { MenuBar, type Menu } from './components/MenuBar'
import { Terminal, type TerminalHandle } from './components/Terminal'
import { TrafficLights } from './components/TrafficLights'
import { useWindowFrame } from './components/useWindowFrame'
import { Vim } from './components/Vim'
import { linksFor, os, profile, type SiteLink } from './content'
import { resolveAddress } from './gui/address'
import { openExternal, readFile, type ShellContext } from './shell/commands'
import { readTheme, saveTheme, onThemeChange, terminalTheme } from './themeStore'
import { themeNames, themes, type ThemeName } from './themes'

type WindowMode = 'normal' | 'maximized' | 'minimized' | 'closed'

function stored<T extends string>(key: string, fallback: T, valid: (value: string) => boolean): T {
  try { const value = localStorage.getItem(key); return value && valid(value) ? (value as T) : fallback } catch { return fallback }
}
function save(key: string, value: string) { try { localStorage.setItem(key, value) } catch { /* storage unavailable */ } }

const narrow = () => typeof window !== 'undefined' && window.matchMedia('(max-width: 720px)').matches

function App() {
  const terminal = useRef<TerminalHandle>(null)
  const browserControls = useRef<BrowserControls | null>(null)
  const [mode, setMode] = useState<WindowMode>(() => (narrow() ? 'maximized' : stored<WindowMode>('portfolio.window', 'normal', (value) => value === 'maximized')))
  const terminalFrame = useWindowFrame('terminal', { disabled: mode !== 'normal', min: { width: 460, height: 300 } })
  const [theme, setThemeState] = useState<ThemeName>(() => terminalTheme(readTheme()))
  const [fontSize, setFontSize] = useState(() => Number(stored('portfolio.font', '15', (value) => /^\d+$/.test(value))))
  const [crt, setCrt] = useState(() => stored('portfolio.crt', 'on', (value) => value === 'on' || value === 'off') === 'on')
  const [matrix, setMatrix] = useState(false)
  const [game, setGame] = useState<GameName | null>(null)
  const [vim, setVim] = useState<{ file: string; text: string } | null>(null)
  const [melting, setMelting] = useState(false)
  const [browser, setBrowser] = useState<{ url: string; stamp: number } | null>(null)
  const [front, setFront] = useState<'terminal' | 'browser'>('terminal')
  const [status, setStatus] = useState('')
  const [sessionKey, setSessionKey] = useState(0)
  const stopMatrix = useCallback(() => setMatrix(false), [])
  const setCrtMode = useCallback((on: boolean) => { setCrt(on); save('portfolio.crt', on ? 'on' : 'off') }, [])
  const closeOverlay = useCallback((message: string) => {
    setGame(null); setVim(null)
    terminal.current?.print([{ type: 'success', text: message }])
    setTimeout(() => terminal.current?.focus(), 30)
  }, [])
  const openFile = useCallback((file: string) => readFile(file), [])
  // Phones have no desktop, so the standard site opens as the page itself.
  const openBrowser = useCallback((url = '/gui') => { if (narrow()) { window.location.assign(url); return } setBrowser({ url, stamp: Date.now() }); setFront('browser') }, [])
  const closeBrowser = useCallback(() => { setBrowser(null); setFront('terminal'); setTimeout(() => terminal.current?.focus(), 30) }, [])
  const browserFront = useCallback((isFront: boolean) => setFront(isFront ? 'browser' : 'terminal'), [])
  const clickBrowser = (event: MouseEvent, url = '/gui') => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    openBrowser(url)
  }
  // Pages of this site open in the in-site Chrome, mail links in the mail app, everything else in a new tab.
  const linkProps = (link: SiteLink) => {
    if (link.url.startsWith('mailto:')) return { href: link.url }
    if (resolveAddress(link.url, location.origin)?.kind === 'page') return { href: link.url, onClick: (event: MouseEvent) => clickBrowser(event, link.url) }
    return { href: link.url, target: '_blank', rel: 'noreferrer noopener' }
  }
  const glyph = (link: SiteLink, className: string) => (link.image ? <img className={className} src={link.icon} alt="" /> : <span className={`${className} link-glyph`} style={link.color ? { background: link.color } : undefined}>{link.icon}</span>)

  const setTheme = useCallback((name: ThemeName) => { setThemeState(name); saveTheme(name) }, [])
  // The standard site can change the theme too (in the in-site Chrome or another tab).
  useEffect(() => onThemeChange((next) => setThemeState(terminalTheme(next))), [])
  const toggleMaximize = useCallback(() => setMode((current) => { const next = current === 'maximized' ? 'normal' : 'maximized'; save('portfolio.window', next); return next }), [])
  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
    else document.documentElement.requestFullscreen?.().catch(() => {})
  }, [])
  const restore = useCallback(() => { setMode((current) => (current === 'closed' ? 'normal' : stored<WindowMode>('portfolio.window', 'normal', (value) => value === 'maximized'))); setTimeout(() => terminal.current?.focus(), 50) }, [])
  const reconnect = useCallback(() => { setSessionKey((key) => key + 1); setMode('normal') }, [])
  const zoom = useCallback((delta: number) => setFontSize((size) => { const next = delta === 0 ? 15 : Math.min(22, Math.max(11, size + delta)); save('portfolio.font', String(next)); return next }), [])

  const ui = useMemo<ShellContext['ui']>(() => ({
    setTheme,
    toggleMaximize,
    toggleFullscreen,
    exit: () => setMode('closed'),
    matrix: () => setMatrix(true),
    replayBoot: () => terminal.current?.replayBoot(),
    setCrt: setCrtMode,
    crt,
    game: (name) => setGame(name),
    vim: (file, text) => setVim({ file, text }),
    meltdown: () => { setMelting(true); setTimeout(() => setMelting(false), 1900) },
    openBrowser,
  }), [crt, openBrowser, setCrtMode, setTheme, toggleFullscreen, toggleMaximize])

  // ↑ ↑ ↓ ↓ ← → ← → b a
  useEffect(() => {
    const code = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a']
    let position = 0
    const handler = (event: KeyboardEvent) => {
      position = event.key === code[position] ? position + 1 : event.key === code[0] ? 1 : 0
      if (position === code.length) { position = 0; terminal.current?.print([{ type: 'success', text: '↑↑↓↓←→←→BA  +30 lives. Also: matrix mode.' }]); setMatrix(true) }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const mod = event.metaKey || (event.ctrlKey && event.shiftKey)
      if (!mod) return
      if (event.key === '=' || event.key === '+') { event.preventDefault(); zoom(1) }
      else if (event.key === '-') { event.preventDefault(); zoom(-1) }
      else if (event.key === '0') { event.preventDefault(); zoom(0) }
      else if (event.key === 'Enter') { event.preventDefault(); toggleMaximize() }
      else if (event.key.toLowerCase() === 'k') { event.preventDefault(); terminal.current?.clear() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [toggleMaximize, zoom])

  const run = (command: string) => { if (mode === 'closed' || mode === 'minimized') restore(); setTimeout(() => terminal.current?.run(command), 60) }

  // macOS swaps the menu bar to the focused app, so Chrome gets its own menus.
  const chrome = (action: keyof BrowserControls) => () => browserControls.current?.[action]()
  const chromeMenus: Menu[] = [
    { label: 'Chrome', items: [
      { label: 'About Google Chrome', action: () => openExternal('https://www.google.com/chrome/') },
      { separator: true },
      { label: 'Quit Chrome', shortcut: '⌘Q', action: closeBrowser },
    ] },
    { label: 'File', items: [
      { label: 'New Tab', shortcut: '⌘T', action: chrome('newTab') },
      { label: 'Open Location…', shortcut: '⌘L', action: chrome('focusAddress') },
      { label: 'Open in a real browser tab', action: chrome('openReal') },
      { separator: true },
      { label: 'Close Tab', shortcut: '⌘W', action: chrome('closeTab') },
      { label: 'Close Window', shortcut: '⇧⌘W', action: closeBrowser },
    ] },
    { label: 'Edit', items: [
      { label: 'Copy', shortcut: '⌘C', action: () => { const text = window.getSelection()?.toString(); if (text) navigator.clipboard?.writeText(text).catch(() => {}) } },
    ] },
    { label: 'View', items: [
      { label: 'Reload This Page', shortcut: '⌘R', action: chrome('reload') },
      { label: 'Enter Full Screen', shortcut: '⌃⌘F', action: toggleFullscreen },
    ] },
    { label: 'History', items: [
      { label: 'Home', shortcut: '⇧⌘H', action: chrome('home') },
      { label: 'Back', shortcut: '⌘[', action: chrome('back') },
      { label: 'Forward', shortcut: '⌘]', action: chrome('forward') },
    ] },
    { label: 'Window', items: [
      { label: 'Minimize', shortcut: '⌘M', action: chrome('minimize') },
      { label: 'Zoom', action: chrome('toggleMax') },
      { separator: true },
      { label: 'Terminal', action: chrome('toTerminal') },
    ] },
    { label: 'Help', items: [
      { label: 'Chrome Help', action: () => openExternal('https://support.google.com/chrome/') },
    ] },
  ]

  const menus: Menu[] = [
    { label: 'Terminal', items: [
      { label: `About ${os.name} ${os.version}`, action: () => run('neofetch') },
      { label: 'View source on GitHub', action: () => openExternal(profile.source) },
      { separator: true },
      { label: `Email ${profile.name.split(' ')[0]}`, action: () => openExternal(`mailto:${profile.email}`) },
      { label: 'Download resume', action: () => openExternal(profile.resume) },
    ] },
    { label: 'Shell', items: [
      { label: 'New session', shortcut: '⌘N', action: reconnect },
      { label: 'Replay SSH login', action: () => run('reboot') },
      { separator: true },
      { label: 'Clear screen', shortcut: '⌃L', action: () => terminal.current?.clear() },
      { label: 'Close session (exit)', shortcut: '⌃D', action: () => setMode('closed') },
    ] },
    { label: 'Edit', items: [
      { label: 'Copy', shortcut: '⌘C', action: () => { const text = window.getSelection()?.toString(); if (text) navigator.clipboard?.writeText(text).catch(() => {}) } },
      { label: 'Paste', shortcut: '⌘V', action: () => { navigator.clipboard?.readText().then((text) => terminal.current?.paste(text.replace(/\n/g, ' '))).catch(() => {}); terminal.current?.focus() } },
      { label: 'Select all output', shortcut: '⌘A', action: () => terminal.current?.selectAll() },
      { label: 'Clear scrollback', shortcut: '⌘K', action: () => terminal.current?.clear() },
    ] },
    { label: 'View', items: [
      { label: mode === 'maximized' ? 'Restore window' : 'Maximize window', shortcut: '⌘↩', action: toggleMaximize },
      { label: 'Enter full screen', shortcut: '⌃⌘F', action: toggleFullscreen },
      { separator: true },
      { label: 'Bigger text', shortcut: '⌘+', action: () => zoom(1) },
      { label: 'Smaller text', shortcut: '⌘−', action: () => zoom(-1) },
      { label: 'Actual size', shortcut: '⌘0', action: () => zoom(0) },
      { separator: true },
      ...themeNames.map((name) => ({ label: themes[name].label, checked: theme === name, action: () => setTheme(name) })),
      { separator: true },
      { label: 'CRT scanlines', checked: crt, action: () => setCrtMode(!crt) },
      { separator: true },
      { label: 'Standard website (GUI)', action: () => openBrowser('/gui') },
    ] },
    { label: 'Go', items: [
      ...['about', 'experience', 'projects', 'publications', 'skills', 'education', 'contact', 'resume'].map((command) => ({ label: command[0]!.toUpperCase() + command.slice(1), action: () => run(command) })),
      { separator: true },
      { label: 'Architecture diagram', action: () => run('view architecture.svg') },
      { label: 'Now', action: () => run('now') },
      { label: 'Guestbook', action: () => run('guestbook') },
      { separator: true },
      { label: 'Play snake', action: () => run('snake') },
      { label: 'Play 2048', action: () => run('2048') },
    ] },
    { label: 'Window', items: [
      { label: 'Minimize', shortcut: '⌘M', action: () => setMode('minimized') },
      { label: 'Zoom', action: toggleMaximize },
      { label: 'Bring to front', action: restore },
    ] },
    { label: 'Help', items: [
      { label: 'Commands', action: () => run('help') },
      { label: 'Keyboard shortcuts', action: () => run('shortcuts') },
      { label: 'Ask the AI assistant', action: () => run('ask what can I ask you about?') },
    ] },
  ]

  const style = { ...themes[theme].vars, '--font-size': `${fontSize}px` } as CSSProperties
  const visible = mode === 'normal' || mode === 'maximized'

  return (
    <div className={`desktop theme-${theme}${crt ? ' crt' : ''}${melting ? ' meltdown' : ''}${browser && front === 'terminal' ? ' terminal-front' : ''}`} style={style}>
      <MenuBar menus={browser && front === 'browser' ? chromeMenus : menus} status={status} />
      <div className="desktop-icons">
        {linksFor('desktop').map((link, index) => (
          <a key={`${link.name}-${index}`} className="desktop-icon" title={link.name} {...linkProps(link)}>
            {glyph(link, 'desktop-chrome')}
            <span className="desktop-icon-label">{link.name}</span>
          </a>
        ))}
      </div>
      <main className={`app-shell ${mode}`}>
        {mode !== 'closed' && (
          <section className="terminal-window" aria-label="Terminal" hidden={mode === 'minimized'} style={terminalFrame.style} {...terminalFrame.frameProps} onPointerDown={() => setFront('terminal')}>
            <header className="window-chrome" {...terminalFrame.titleBar} onDoubleClick={(event) => { if (!(event.target as HTMLElement).closest('button')) toggleMaximize() }}>
              <div className="traffic-lights"><TrafficLights name="terminal" maximized={mode === 'maximized'} onClose={() => setMode('closed')} onMinimize={() => setMode('minimized')} onMaximize={toggleMaximize} /></div>
              <div className="window-title">guest@{profile.host}: ~ — ssh — zsh</div>
              <div className="window-actions" aria-hidden="true" />
            </header>
            <Terminal key={sessionKey} ref={terminal} theme={theme} ui={ui} onStatus={setStatus} suspended={Boolean(game || vim || matrix || (browser && front === 'browser'))} />
            <footer className="terminal-footer"><span>zsh</span><span>UTF-8</span><span>{themes[theme].label}</span><span className="footer-status">{status || `● ssh guest@${profile.host}`}</span></footer>
            {terminalFrame.handles}
          </section>
        )}
        {mode === 'closed' && (
          <section className="session-closed">
            <p className="muted-text">Connection to {profile.host} closed.</p>
            <button type="button" className="reconnect" onClick={reconnect}>ssh guest@{profile.host}</button>
          </section>
        )}
      </main>
      <nav className="dock" aria-label="Dock">
        <button type="button" className={`dock-item${visible ? ' running' : ''}`} onClick={mode === 'closed' ? reconnect : restore} title="Terminal">
          <span className="dock-icon app"><img src="/icons/terminal.svg" alt="" /></span>
        </button>
        {linksFor('dock').map((link, index) => (
          <a key={`${link.name}-${index}`} className="dock-item" title={link.name} aria-label={link.name} {...linkProps(link)}><span className={`dock-icon app${link.tile ? ' tile' : ''}`}>{glyph(link, '')}</span></a>
        ))}
        {browser && <>
          <span className="dock-separator" aria-hidden="true" />
          <a className="dock-item running" href="/gui" title="Chrome" aria-label="Chrome" onClick={clickBrowser}><span className="dock-icon app tile"><img src="/icons/chrome.svg" alt="" /></span></a>
        </>}
      </nav>
      {browser && <BrowserWindow controls={browserControls} url={browser.url} stamp={browser.stamp} onClose={closeBrowser} onFront={browserFront} onOpenTerminal={() => { setFront('terminal'); restore() }} />}
      {game && <GameOverlay game={game} onExit={closeOverlay} />}
      {vim && <Vim file={vim.file} text={vim.text} onExit={closeOverlay} open={openFile} />}
      {matrix && <MatrixRain onDone={stopMatrix} />}
    </div>
  )
}

export default App
