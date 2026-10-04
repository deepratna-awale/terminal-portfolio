import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import './windowFrame.css'

// Moving and resizing for any desktop window, the macOS way:
// - drag the title bar to move; the window stays on screen, below the menu bar
// - resize from any edge or corner (invisible zones, shown only by the cursor);
//   the opposite edge stays put, Option/Alt resizes around the centre and Shift
//   on a corner keeps the aspect ratio
// - position and size are remembered per window
// Until the first move or resize the window keeps its CSS layout (centred).
//
//   const frame = useWindowFrame('terminal', { disabled: maximized })
//   <section style={frame.style}>
//     <header {...frame.titleBar}>…</header>…{frame.handles}
//   </section>

type Rect = { x: number; y: number; width: number; height: number }
type Edge = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'
type Drag = { kind: 'move' | Edge; x: number; y: number; start: Rect; frame: HTMLElement }
type Options = { disabled?: boolean; min?: { width: number; height: number } }

const EDGES: Edge[] = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw']
const key = (id: string) => `portfolio.window.${id}.rect`
// Phones, tablets and narrow windows show every window full screen.
const desktop = () => typeof window !== 'undefined' && !window.matchMedia?.('(max-width: 720px), (pointer: coarse)').matches
const menubar = () => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--menubar-h')) || 28
// Title bar controls keep their own clicks.
const interactive = (target: EventTarget | null) => Boolean((target as HTMLElement | null)?.closest('button, input, textarea, select, a, [role="tab"], [data-no-drag]'))

function fit(rect: Rect, min: Options['min'] & object): Rect {
  const top = menubar()
  const width = Math.min(Math.max(rect.width, min.width), window.innerWidth)
  const height = Math.min(Math.max(rect.height, min.height), window.innerHeight - top)
  return {
    width, height,
    x: Math.min(Math.max(rect.x, 0), window.innerWidth - width),
    y: Math.min(Math.max(rect.y, top), window.innerHeight - height),
  }
}

export function resizeRect(start: Rect, edge: Edge, dx: number, dy: number, { center = false, aspect = false } = {}, min = { width: 0, height: 0 }): Rect {
  let left = start.x
  let right = start.x + start.width
  let top = start.y
  let bottom = start.y + start.height
  const cx = (left + right) / 2
  const cy = (top + bottom) / 2
  if (edge.includes('e')) { right += dx; if (center) left -= dx }
  if (edge.includes('w')) { left += dx; if (center) right -= dx }
  if (edge.includes('s')) { bottom += dy; if (center) top -= dy }
  if (edge.includes('n')) { top += dy; if (center) bottom -= dy }
  let width = Math.max(min.width, right - left)
  let height = Math.max(min.height, bottom - top)
  if (aspect && edge.length === 2) {
    const ratio = start.width / start.height
    if (width / height > ratio) height = width / ratio
    else width = height * ratio
  }
  // Grow or shrink away from the anchored side (or the centre).
  const x = center ? cx - width / 2 : edge.includes('w') ? start.x + start.width - width : start.x
  const y = center ? cy - height / 2 : edge.includes('n') ? start.y + start.height - height : start.y
  return { x, y, width, height }
}

function load(id: string): Rect | null {
  try {
    const saved = JSON.parse(localStorage.getItem(key(id)) ?? 'null') as Rect | null
    return saved && [saved.x, saved.y, saved.width, saved.height].every(Number.isFinite) ? saved : null
  } catch { return null }
}

export function useWindowFrame(id: string, { disabled = false, min = { width: 420, height: 280 } }: Options = {}) {
  const [rect, setRect] = useState<Rect | null>(() => (typeof window === 'undefined' ? null : load(id)))
  const [enabled, setEnabled] = useState(desktop)
  const drag = useRef<Drag | null>(null)
  const minRef = useRef(min)
  useEffect(() => { minRef.current = min })

  useEffect(() => {
    const update = () => { setEnabled(desktop()); setRect((current) => (current ? fit(current, minRef.current) : current)) }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  const save = useCallback((next: Rect) => { try { localStorage.setItem(key(id), JSON.stringify(next)) } catch { /* storage unavailable */ } }, [id])

  const begin = useCallback((kind: Drag['kind'], event: ReactPointerEvent<HTMLElement>, frame: HTMLElement | null) => {
    if (event.button !== 0 || !frame) return
    const box = frame.getBoundingClientRect()
    drag.current = { kind, x: event.clientX, y: event.clientY, start: { x: box.left, y: box.top, width: box.width, height: box.height }, frame }
    event.currentTarget.setPointerCapture(event.pointerId)
    document.documentElement.classList.add(kind === 'move' ? 'window-moving' : 'window-resizing')
  }, [])

  const move = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    const current = drag.current
    if (!current) return
    const dx = event.clientX - current.x
    const dy = event.clientY - current.y
    const limits = minRef.current
    const next = current.kind === 'move'
      ? { ...current.start, x: current.start.x + dx, y: current.start.y + dy }
      : resizeRect(current.start, current.kind, dx, dy, { center: event.altKey, aspect: event.shiftKey }, limits)
    setRect(fit(next, limits))
  }, [])

  const end = useCallback(() => {
    if (!drag.current) return
    drag.current = null
    document.documentElement.classList.remove('window-moving', 'window-resizing')
    setRect((current) => { if (current) save(current); return current })
  }, [save])

  const active = enabled && !disabled
  const frameOf = (event: ReactPointerEvent<HTMLElement>) => event.currentTarget.closest<HTMLElement>('[data-window-frame]')

  return {
    active,
    style: (active && rect
      ? { position: 'fixed', left: rect.x, top: rect.y, width: rect.width, height: rect.height, minWidth: 0, minHeight: 0, maxWidth: 'none', maxHeight: 'none', margin: 0, transform: 'none' }
      : undefined) as CSSProperties | undefined,
    // Spread onto the window root.
    frameProps: { 'data-window-frame': id },
    // Spread onto the title bar: dragging it moves the window.
    titleBar: {
      onPointerDown: (event: ReactPointerEvent<HTMLElement>) => { if (active && !interactive(event.target)) begin('move', event, frameOf(event)) },
      onPointerMove: move,
      onPointerUp: end,
      onPointerCancel: end,
    },
    handles: active
      ? EDGES.map((edge) => (
          <div key={edge} className={`window-edge window-edge-${edge}`} aria-hidden="true" onPointerDown={(event) => begin(edge, event, frameOf(event))} onPointerMove={move} onPointerUp={end} onPointerCancel={end} />
        ))
      : null,
  }
}
