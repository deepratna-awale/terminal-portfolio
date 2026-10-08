import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import './Achievement.css'

// Sherlock's bent tobacco pipe with a wisp of smoke.
function Pipe() {
  return (
    <svg viewBox="0 0 48 48" width={36} height={36} aria-hidden="true">
      <path d="M30 11c-2.4-2.2 1.4-4.2-.8-6.6M36 11c-2.4-2.2 1.4-4.2-.8-6.6" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" opacity={0.6} />
      <path d="M24 15h18" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" />
      <path d="M25 15h16v9a8 8 0 0 1-16 0z" fill="currentColor" />
      <path d="M26.5 28.5c-4.5 6.5-13 8.5-19 3.5" fill="none" stroke="currentColor" strokeWidth={4.2} strokeLinecap="round" />
      <path d="M8 32l-4.5-3.6" stroke="currentColor" strokeWidth={3} strokeLinecap="round" />
    </svg>
  )
}

// An "Achievement Unlocked" toast in the top right corner of the screen, outside any window.
// Waits until the page is visible again, since the search it celebrates opens in a new tab.
export function Achievement({ title, onDone }: { title: string; onDone: () => void }) {
  const [shown, setShown] = useState(false)
  useEffect(() => {
    const show = () => { if (!document.hidden) setShown(true) }
    const timer = setTimeout(show, 300)
    document.addEventListener('visibilitychange', show)
    return () => { clearTimeout(timer); document.removeEventListener('visibilitychange', show) }
  }, [])
  if (!shown) return null
  return createPortal(
    <div className="achievement" role="status" onAnimationEnd={(event) => { if (event.target === event.currentTarget) onDone() }}>
      <span className="achievement-icon"><Pipe /></span>
      <span className="achievement-text"><small>Achievement Unlocked</small><b>{title}</b></span>
    </div>,
    document.body,
  )
}
