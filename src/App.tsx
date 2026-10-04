import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import './App.css'
import { MatrixRain } from './components/MatrixRain'
import { MenuBar, type Menu } from './components/MenuBar'
import { Terminal, type TerminalHandle } from './components/Terminal'
import { profile } from './content'
import { openExternal, type ShellContext } from './shell/commands'
import { isThemeName, themeNames, themes, type ThemeName } from './themes'

type WindowMode = 'normal' | 'maximized' | 'minimized' | 'closed'

function stored<T extends string>(key: string, fallback: T, valid: (value: string) => boolean): T {
  try { const value = localStorage.getItem(key); return value && valid(value) ? (value as T) : fallback } catch { return fallback }
}
function save(key: string, value: string) { try { localStorage.setItem(key, value) } catch { /* storage unavailable */ } }

const narrow = () => typeof window !== 'undefined' && window.matchMedia('(max-width: 720px)').matches

function App() {
  const terminal = useRef<TerminalHandle>(null)
  const [mode, setMode] = useState<WindowMode>(() => (narrow() ? 'maximized' : stored<WindowMode>('portfolio.window', 'normal', (value) => value === 'maximized')))
  const [theme, setThemeState] = useState<ThemeName>(() => stored<ThemeName>('portfolio.theme', 'phosphor', isThemeName))
  const [fontSize, setFontSize] = useState(() => Number(stored('portfolio.font', '15', (value) => /^\d+$/.test(value))))
  const [crt, setCrt] = useState(() => stored('portfolio.crt', 'on', (value) => value === 'on' || value === 'off') === 'on')
  const [matrix, setMatrix] = useState(false)
  const [status, setStatus] = useState('')
  const [sessionKey, setSessionKey] = useState(0)
  const stopMatrix = useCallback(() => setMatrix(false), [])

  const setTheme = useCallback((name: ThemeName) => { setThemeState(name); save('portfolio.theme', name) }, [])
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
  }), [setTheme, toggleFullscreen, toggleMaximize])

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

  const menus: Menu[] = [
    { label: 'Terminal', items: [
      { label: 'About this portfolio', action: () => run('neofetch') },
      { label: 'View source on GitHub', action: () => openExternal(profile.source) },
      { separator: true },
      { label: 'Email Deepratna', action: () => openExternal(`mailto:${profile.email}`) },
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
      { label: 'CRT scanlines', checked: crt, action: () => setCrt((on) => { save('portfolio.crt', on ? 'off' : 'on'); return !on }) },
    ] },
    { label: 'Go', items: [
      ...['about', 'experience', 'projects', 'publications', 'skills', 'education', 'contact', 'resume'].map((command) => ({ label: command[0]!.toUpperCase() + command.slice(1), action: () => run(command) })),
      { separator: true },
      { label: 'Architecture diagram', action: () => run('view architecture.svg') },
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
    <div className={`desktop theme-${theme}${crt ? ' crt' : ''}`} style={style}>
      <MenuBar menus={menus} status={status} />
      <main className={`app-shell ${mode}`}>
        {mode !== 'closed' && (
          <section className="terminal-window" aria-label="Terminal" hidden={mode === 'minimized'}>
            <header className="window-chrome" onDoubleClick={toggleMaximize}>
              <div className="traffic-lights">
                <button type="button" className="light close" aria-label="Close session" title="Close" onClick={() => setMode('closed')} />
                <button type="button" className="light minimize" aria-label="Minimize" title="Minimize" onClick={() => setMode('minimized')} />
                <button type="button" className="light maximize" aria-label={mode === 'maximized' ? 'Restore' : 'Maximize'} title={mode === 'maximized' ? 'Restore' : 'Maximize'} onClick={toggleMaximize} />
              </div>
              <div className="window-title">guest@{profile.host}: ~ — ssh — zsh</div>
              <div className="window-actions"><button type="button" onClick={toggleMaximize} aria-label="Toggle maximize">{mode === 'maximized' ? '⤡' : '⤢'}</button></div>
            </header>
            <Terminal key={sessionKey} ref={terminal} theme={theme} ui={ui} onStatus={setStatus} />
            <footer className="terminal-footer"><span>zsh</span><span>UTF-8</span><span>{themes[theme].label}</span><span className="footer-status">{status || `● ssh guest@${profile.host}`}</span></footer>
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
          <span className="dock-icon">&gt;_</span>
        </button>
        <a className="dock-item" href={profile.github} target="_blank" rel="noreferrer noopener" title="GitHub"><span className="dock-icon gh">GH</span></a>
        <a className="dock-item" href={profile.linkedin} target="_blank" rel="noreferrer noopener" title="LinkedIn"><span className="dock-icon in">in</span></a>
        <a className="dock-item" href={`mailto:${profile.email}`} title="Email"><span className="dock-icon mail">@</span></a>
      </nav>
      {matrix && <MatrixRain onDone={stopMatrix} />}
    </div>
  )
}

export default App
