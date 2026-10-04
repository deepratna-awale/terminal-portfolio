import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import './resizable.css'

// Drag-to-resize for any desktop window. Centred windows grow on both sides so
// the dragged edge stays under the cursor; top-anchored windows grow downward
// and report how far a top-edge drag should move them (onTopShift). Sizes are
// clamped to the viewport and remembered per window in localStorage.
//
//   const resize = useResizable('terminal', { disabled: maximized })
//   <section style={resize.style}>...{resize.handles}</section>

type Size = { width: number; height: number }
type Edge = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'
type Options = { disabled?: boolean; min?: Size; anchor?: 'center' | 'top'; onTopShift?: (shift: number, phase: 'start' | 'move') => void }

const EDGES: Edge[] = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw']
const MENUBAR = 28
const key = (id: string) => `portfolio.window.${id}.size`

// Phones, tablets and narrow windows show every window full screen.
const resizable = () => typeof window !== 'undefined' && !window.matchMedia?.('(max-width: 720px), (pointer: coarse)').matches

function clamp(size: Size, min: Size): Size {
  const maxWidth = Math.max(min.width, window.innerWidth - 16)
  const maxHeight = Math.max(min.height, window.innerHeight - MENUBAR - 16)
  return { width: Math.round(Math.min(maxWidth, Math.max(min.width, size.width))), height: Math.round(Math.min(maxHeight, Math.max(min.height, size.height))) }
}

function load(id: string): Size | null {
  try {
    const saved = JSON.parse(localStorage.getItem(key(id)) ?? 'null') as Size | null
    return saved && Number.isFinite(saved.width) && Number.isFinite(saved.height) ? saved : null
  } catch { return null }
}

export function useResizable(id: string, { disabled = false, min = { width: 420, height: 280 }, anchor = 'center', onTopShift }: Options = {}) {
  const [size, setSize] = useState<Size | null>(() => (typeof window === 'undefined' ? null : load(id)))
  const [enabled, setEnabled] = useState(resizable)
  const drag = useRef<{ edge: Edge; x: number; y: number; start: Size } | null>(null)
  const minRef = useRef(min)
  const shiftRef = useRef(onTopShift)
  useEffect(() => { minRef.current = min; shiftRef.current = onTopShift })

  useEffect(() => {
    const update = () => {
      setEnabled(resizable())
      setSize((current) => (current ? clamp(current, minRef.current) : current))
    }
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  const start = useCallback((edge: Edge) => (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    const frame = event.currentTarget.parentElement
    if (!frame) return
    event.preventDefault()
    event.stopPropagation()
    const rect = frame.getBoundingClientRect()
    drag.current = { edge, x: event.clientX, y: event.clientY, start: { width: rect.width, height: rect.height } }
    event.currentTarget.setPointerCapture(event.pointerId)
    document.documentElement.classList.add('window-resizing')
    if (anchor === 'top' && edge.includes('n')) shiftRef.current?.(0, 'start')
  }, [anchor])

  const move = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const current = drag.current
    if (!current) return
    const dx = event.clientX - current.x
    const dy = event.clientY - current.y
    const horizontal = current.edge.includes('e') ? dx : current.edge.includes('w') ? -dx : 0
    const vertical = current.edge.includes('s') ? dy : current.edge.includes('n') ? -dy : 0
    const next = clamp({ width: current.start.width + horizontal * 2, height: current.start.height + vertical * (anchor === 'top' ? 1 : 2) }, minRef.current)
    if (anchor === 'top' && current.edge.includes('n')) shiftRef.current?.(current.start.height - next.height, 'move')
    setSize(next)
  }, [anchor])

  const end = useCallback(() => {
    if (!drag.current) return
    drag.current = null
    document.documentElement.classList.remove('window-resizing')
    setSize((current) => {
      if (current) { try { localStorage.setItem(key(id), JSON.stringify(current)) } catch { /* storage unavailable */ } }
      return current
    })
  }, [id])

  const reset = useCallback(() => {
    setSize(null)
    try { localStorage.removeItem(key(id)) } catch { /* storage unavailable */ }
  }, [id])

  const active = enabled && !disabled
  return {
    active,
    reset,
    style: (active && size ? { width: size.width, height: size.height, minWidth: 0, minHeight: 0, maxWidth: 'none', maxHeight: 'none' } : undefined) as CSSProperties | undefined,
    handles: active
      ? EDGES.map((edge) => (
          <div key={edge} className={`resize-handle resize-${edge}`} aria-hidden="true" onPointerDown={start(edge)} onPointerMove={move} onPointerUp={end} onPointerCancel={end} onDoubleClick={reset} />
        ))
      : null,
  }
}
