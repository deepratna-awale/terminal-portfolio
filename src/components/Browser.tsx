import { useCallback, useEffect, useRef, useState, type RefObject, type CSSProperties, type FormEvent, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { ArrowLeft, ArrowRight, CircleUserRound, EllipsisVertical, ExternalLink, Globe, Lock, Plus, RotateCw, Search, SquareTerminal, Star, X } from 'lucide-react'
import { linksFor, profile } from '../content'
import { HOME, NEWTAB, pageHash, pageTitle, resolveAddress } from '../gui/address'
import { Portfolio } from '../gui/Portfolio'
import './Browser.css'
import { TrafficLights } from './TrafficLights'

type Tab = { id: number; history: string[]; index: number; reload: number; loading: boolean }
type Mode = 'normal' | 'maximized' | 'minimized'
type Props = {
  url: string
  onClose: () => void
  onOpenTerminal?: () => void
  stamp?: number
  onFront?: (front: boolean) => void
}

const origin = () => (typeof location === 'undefined' ? profile.website : location.origin)
const pageFor = (url: string) => { const target = resolveAddress(url, origin()); return target?.kind === 'page' ? target.url : HOME }
const current = (tab: Tab) => tab.history[tab.index] ?? HOME
const samePage = (a: string, b: string) => a.split('#')[0] === b.split('#')[0]
const hostLabel = (url: string) => { try { const parsed = new URL(url); return parsed.protocol === 'mailto:' ? 'your mail app' : parsed.host.replace(/^www\./, '') } catch { return 'a new tab' } }
const modifier = (event: { metaKey: boolean; ctrlKey: boolean; shiftKey: boolean; altKey: boolean }) => event.metaKey || event.ctrlKey || event.shiftKey || event.altKey

let nextId = 1

function NewTabPage({ onGo }: { onGo: (input: string) => void }) {
  const [query, setQuery] = useState('')
  const submit = (event: FormEvent) => { event.preventDefault(); if (query.trim()) onGo(query) }
  return (
    <div className="cb-newtab">
      <div className="cb-nt-mark" aria-hidden="true"><img src="/favicon.svg" alt="" width={72} height={72} /></div>
      <form className="cb-nt-search" onSubmit={submit} role="search">
        <Search size={18} aria-hidden="true" />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search Google or type a URL" aria-label="Search Google or type a URL" />
      </form>
      <ul className="cb-tiles">
        {linksFor('newtab').map((shortcut, index) => (
          <li key={`${shortcut.name}-${index}`}>
            <a href={shortcut.url} onClick={(event) => { if (modifier(event)) return; event.preventDefault(); onGo(shortcut.url) }}>
              <span className={`cb-tile-icon${shortcut.image ? ' image' : ''}`} style={!shortcut.image && shortcut.color ? { background: shortcut.color } : undefined}>{shortcut.image ? <img src={shortcut.icon} alt="" width={24} height={24} /> : shortcut.icon}</span>
              <span className="cb-tile-label">{shortcut.name}</span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}

// What the desktop menu bar can do to the browser while it is the active app.
export type BrowserControls = { newTab: () => void; closeTab: () => void; back: () => void; forward: () => void; reload: () => void; home: () => void; focusAddress: () => void; openReal: () => void; minimize: () => void; toggleMax: () => void; toTerminal: () => void }

export function BrowserWindow({ url, onClose, onOpenTerminal, stamp, onFront, controls }: Props & { controls?: RefObject<BrowserControls | null> }) {
  const [tabs, setTabs] = useState<Tab[]>(() => [{ id: nextId++, history: [pageFor(url)], index: 0, reload: 0, loading: true }])
  const [activeId, setActiveId] = useState(() => tabs[0]!.id)
  const [mode, setMode] = useState<Mode>('normal')
  const [address, setAddress] = useState<string | null>(null)
  const [toast, setToast] = useState<{ text: string; key: number } | null>(null)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [menu, setMenu] = useState(false)
  const root = useRef<HTMLElement>(null)
  const addressInput = useRef<HTMLInputElement>(null)
  const focused = useRef(true)
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>())
  const active = tabs.find((tab) => tab.id === activeId) ?? tabs[0]!
  const activeUrl = current(active)

  const later = useCallback((fn: () => void, ms: number) => {
    const timer = setTimeout(() => { timers.current.delete(timer); fn() }, ms)
    timers.current.add(timer)
  }, [])
  useEffect(() => { const pending = timers.current; return () => pending.forEach(clearTimeout) }, [])

  const update = useCallback((id: number, change: (tab: Tab) => Tab) => setTabs((list) => list.map((tab) => (tab.id === id ? change(tab) : tab))), [])
  const finishLoading = useCallback((id: number, ms = 420) => later(() => update(id, (tab) => ({ ...tab, loading: false })), ms), [later, update])
  useEffect(() => { finishLoading(tabs[0]!.id, 500) }, []) // oxlint-disable-line react-hooks/exhaustive-deps -- first paint only

  const flash = useCallback((text: string) => {
    const key = Date.now()
    setToast({ text, key })
    later(() => setToast((value) => (value?.key === key ? null : value)), 2400)
  }, [later])

  const openReal = useCallback((target: string) => {
    if (target.startsWith('mailto:')) { window.location.href = target; flash('Opening your mail app…'); return }
    window.open(target, '_blank', 'noopener,noreferrer')
    flash(`Opened ${hostLabel(target)} in a new tab`)
  }, [flash])

  const toTerminal = useCallback(() => {
    setMode('minimized')
    onFront?.(false)
    onOpenTerminal?.()
  }, [onFront, onOpenTerminal])

  const push = useCallback((id: number, page: string) => {
    const tab = tabs.find((item) => item.id === id)
    if (!tab || current(tab) === page) return
    const loads = !samePage(current(tab), page)
    update(id, (item) => ({ ...item, history: [...item.history.slice(0, item.index + 1), page], index: item.index + 1, loading: loads || item.loading }))
    if (loads) finishLoading(id)
  }, [finishLoading, tabs, update])

  const navigate = useCallback((input: string, id = activeId) => {
    const target = resolveAddress(input, origin())
    if (!target) return
    setAddress(null)
    if (target.kind === 'page') push(id, target.url)
    else if (target.kind === 'terminal') toTerminal()
    else openReal(target.url)
  }, [activeId, openReal, push, toTerminal])

  const go = (delta: number) => {
    const next = active.index + delta
    if (next < 0 || next >= active.history.length) return
    const loads = !samePage(current(active), active.history[next]!)
    update(active.id, (tab) => ({ ...tab, index: next, loading: loads || tab.loading }))
    if (loads) finishLoading(active.id, 260)
    setAddress(null)
  }
  const reload = () => {
    if (active.loading) { update(active.id, (tab) => ({ ...tab, loading: false })); return }
    update(active.id, (tab) => ({ ...tab, reload: tab.reload + 1, loading: true }))
    finishLoading(active.id, 520)
  }

  const newTab = useCallback(() => {
    const id = nextId++
    setTabs((list) => [...list, { id, history: [NEWTAB], index: 0, reload: 0, loading: false }])
    setActiveId(id)
    setAddress(null)
    later(() => addressInput.current?.focus(), 30)
  }, [later])

  const closeTab = useCallback((id: number) => {
    if (tabs.length === 1) { onClose(); return }
    const index = tabs.findIndex((tab) => tab.id === id)
    const rest = tabs.filter((tab) => tab.id !== id)
    if (id === activeId) setActiveId(rest[Math.min(index, rest.length - 1)]!.id)
    setTabs(rest)
  }, [activeId, onClose, tabs])

  // Reopening from the dock, desktop icon or `gui` restores a minimized window.
  const [seenStamp, setSeenStamp] = useState(stamp)
  if (stamp !== seenStamp) {
    setSeenStamp(stamp)
    if (mode === 'minimized') setMode('normal')
  }
  const firstStamp = useRef(true)
  useEffect(() => {
    if (firstStamp.current) { firstStamp.current = false; return }
    focused.current = true
    const page = pageFor(url)
    if (!samePage(page, activeUrl)) push(activeId, page) // oxlint-disable-line react/set-state-in-effect -- reopen request from outside
  }, [stamp]) // oxlint-disable-line react-hooks/exhaustive-deps -- only on a new open request

  useEffect(() => {
    const down = (event: PointerEvent) => { focused.current = Boolean(root.current?.contains(event.target as Node)) }
    const keys = (event: KeyboardEvent) => {
      if (!focused.current || mode === 'minimized' || !(event.metaKey || event.ctrlKey) || event.altKey || event.shiftKey) return
      const key = event.key.toLowerCase()
      if (key === 'l') { event.preventDefault(); addressInput.current?.focus(); addressInput.current?.select() }
      else if (key === 't') { event.preventDefault(); newTab() }
      else if (key === 'w') { event.preventDefault(); closeTab(activeId) }
      else if (key === 'r') { event.preventDefault(); update(activeId, (tab) => ({ ...tab, reload: tab.reload + 1, loading: true })); finishLoading(activeId, 520) }
    }
    window.addEventListener('pointerdown', down, true)
    window.addEventListener('keydown', keys, true)
    return () => { window.removeEventListener('pointerdown', down, true); window.removeEventListener('keydown', keys, true) }
  }, [activeId, closeTab, finishLoading, mode, newTab, update])

  useEffect(() => {
    if (!menu) return
    const close = (event: PointerEvent) => { if (!(event.target as HTMLElement).closest?.('.cb-menu-wrap')) setMenu(false) }
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setMenu(false) }
    window.addEventListener('pointerdown', close)
    window.addEventListener('keydown', escape)
    return () => { window.removeEventListener('pointerdown', close); window.removeEventListener('keydown', escape) }
  }, [menu])

  const drag = useRef<{ x: number; y: number; ox: number; oy: number; minY: number; maxY: number } | null>(null)
  const startDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (mode !== 'normal' || event.button !== 0 || event.target !== event.currentTarget || window.matchMedia('(max-width: 720px)').matches) return
    const rect = root.current!.getBoundingClientRect()
    drag.current = { x: event.clientX, y: event.clientY, ox: offset.x, oy: offset.y, minY: 28 - rect.top, maxY: window.innerHeight - 60 - rect.top }
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  const moveDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const start = drag.current
    if (!start) return
    const dy = Math.min(start.maxY, Math.max(start.minY, event.clientY - start.y))
    setOffset({ x: start.ox + event.clientX - start.x, y: start.oy + dy })
  }
  const endDrag = () => { drag.current = null }
  const toggleMax = () => setMode((value) => (value === 'maximized' ? 'normal' : 'maximized'))
  const minimize = () => { setMode('minimized'); onFront?.(false) }

  const submitAddress = (event: FormEvent) => { event.preventDefault(); if (address !== null) navigate(address); addressInput.current?.blur() }
  const shown = address ?? (activeUrl === NEWTAB ? '' : activeUrl)
  const secure = activeUrl !== NEWTAB && address === null

  const tabKeys = (event: ReactKeyboardEvent<HTMLDivElement>, id: number) => {
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setActiveId(id) }
  }
  useEffect(() => {
    if (!controls) return
    controls.current = {
      newTab, closeTab: () => closeTab(activeId), back: () => go(-1), forward: () => go(1), reload, home: () => navigate(HOME),
      focusAddress: () => addressInput.current?.focus(), openReal: () => openReal(activeUrl === NEWTAB ? `${origin()}/gui` : `${origin()}/gui${pageHash(activeUrl) ? `#${pageHash(activeUrl)}` : ''}`),
      minimize, toggleMax, toTerminal,
    }
  })
  const auxClose = (event: ReactMouseEvent, id: number) => { if (event.button === 1) { event.preventDefault(); closeTab(id) } }

  return (
    <section
      ref={root}
      className={`cb cb-${mode}`}
      hidden={mode === 'minimized'}
      aria-label="Browser"
      style={mode === 'normal' ? ({ '--dx': `${offset.x}px`, '--dy': `${offset.y}px` } as CSSProperties) : undefined}
      onPointerDownCapture={() => onFront?.(true)}
      onFocusCapture={() => { focused.current = true }}
    >
      <div className="cb-titlebar" onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag} onDoubleClick={(event) => { if (!(event.target as HTMLElement).closest('button, input, a, [role="tab"]')) toggleMax() }}>
        <div className="cb-lights"><TrafficLights name="browser" maximized={mode === 'maximized'} onClose={onClose} onMinimize={minimize} onMaximize={toggleMax} /></div>
        <div className="cb-tabs" role="tablist" aria-label="Tabs">
          {tabs.map((tab) => {
            const page = current(tab)
            const selected = tab.id === active.id
            return (
              <div
                key={tab.id}
                role="tab"
                aria-selected={selected}
                tabIndex={selected ? 0 : -1}
                className={`cb-tab${selected ? ' active' : ''}`}
                title={pageTitle(page)}
                onPointerDown={(event) => { if (event.button === 0) setActiveId(tab.id) }}
                onAuxClick={(event) => auxClose(event, tab.id)}
                onKeyDown={(event) => tabKeys(event, tab.id)}
              >
                <span className="cb-favicon" aria-hidden="true">{tab.loading ? <span className="cb-spinner" /> : page === NEWTAB ? <Globe size={14} /> : <img src="/favicon.svg" alt="" width={16} height={16} />}</span>
                <span className="cb-tab-title">{pageTitle(page)}</span>
                <button type="button" className="cb-tab-close" aria-label={`Close ${pageTitle(page)}`} onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); closeTab(tab.id) }}><X size={13} strokeWidth={2.5} /></button>
              </div>
            )
          })}
          <button type="button" className="cb-new" aria-label="New tab" title="New tab (⌘T)" onClick={newTab}><Plus size={17} /></button>
        </div>
      </div>

      <div className="cb-toolbar">
        <button type="button" className="cb-tool" aria-label="Back" title="Back" disabled={active.index === 0} onClick={() => go(-1)}><ArrowLeft size={18} /></button>
        <button type="button" className="cb-tool" aria-label="Forward" title="Forward" disabled={active.index >= active.history.length - 1} onClick={() => go(1)}><ArrowRight size={18} /></button>
        <button type="button" className="cb-tool" aria-label={active.loading ? 'Stop' : 'Reload'} title={active.loading ? 'Stop' : 'Reload (⌘R)'} onClick={reload}>{active.loading ? <X size={18} /> : <RotateCw size={16} />}</button>
        <form className="cb-omnibox" onSubmit={submitAddress} role="search">
          <span className="cb-site" aria-hidden="true">{secure ? <Lock size={13} strokeWidth={2.4} /> : <Search size={14} />}</span>
          <input
            ref={addressInput}
            value={shown}
            spellCheck={false}
            autoCapitalize="off"
            autoComplete="off"
            aria-label="Address and search bar"
            placeholder="Search Google or type a URL"
            onChange={(event) => setAddress(event.target.value)}
            onFocus={(event) => { setAddress(shown); const input = event.currentTarget; requestAnimationFrame(() => input.select()) }}
            onBlur={() => setAddress(null)}
            onKeyDown={(event) => { if (event.key === 'Escape') { setAddress(null); event.currentTarget.blur() } }}
          />
          <Star size={16} className="cb-star" aria-hidden="true" />
        </form>
        <span className="cb-avatar" title="Guest (you're browsing as a guest)" aria-label="Guest profile"><CircleUserRound size={18} /></span>
        <div className="cb-menu-wrap">
          <button type="button" className="cb-tool" aria-label="Browser menu" aria-haspopup="menu" aria-expanded={menu} title="Customize and control" onClick={() => setMenu((open) => !open)}><EllipsisVertical size={18} /></button>
          {menu && (
            <div className="cb-menu" role="menu" onClick={() => setMenu(false)}>
              <button type="button" role="menuitem" onClick={newTab}><Plus size={15} /> New tab<kbd>⌘T</kbd></button>
              <button type="button" role="menuitem" onClick={() => openReal(activeUrl === NEWTAB ? origin() + '/gui' : `${origin()}/gui${pageHash(activeUrl) ? `#${pageHash(activeUrl)}` : ''}`)}><ExternalLink size={15} /> Open in a real tab</button>
              <button type="button" role="menuitem" onClick={toTerminal}><SquareTerminal size={15} /> Back to the terminal</button>
              <hr />
              <button type="button" role="menuitem" onClick={onClose}><X size={15} /> Close window</button>
            </div>
          )}
        </div>
      </div>
      {active.loading && <div className="cb-progress" aria-hidden="true" />}

      <div className="cb-viewports">
        {tabs.map((tab) => {
          const page = current(tab)
          return (
            <div key={tab.id} className="cb-viewport" hidden={tab.id !== active.id} role="tabpanel" aria-label={pageTitle(page)}>
              {page === NEWTAB
                ? <NewTabPage key={`${tab.index}-${tab.reload}`} onGo={(input) => navigate(input, tab.id)} />
                : <Portfolio key={tab.reload} embedded anchor={pageHash(page)} onExternal={openReal} onOpenTerminal={toTerminal} onAnchor={(id) => push(tab.id, id ? `${HOME}#${id}` : HOME)} />}
            </div>
          )
        })}
        {toast && <div className="cb-toast" role="status" key={toast.key}>{toast.text}</div>}
      </div>
    </section>
  )
}
