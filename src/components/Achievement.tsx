import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import './Achievement.css'

// Sherlock's calabash pipe: gourd body, meerschaum cup, glowing tobacco, black mouthpiece.
function Pipe() {
  return (
    <svg viewBox="0 0 48 48" width={46} height={46} aria-hidden="true">
      <defs>
        <linearGradient id="achievement-gourd" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#e2a24e" /><stop offset=".55" stopColor="#a8611f" /><stop offset="1" stopColor="#5e3210" /></linearGradient>
        <linearGradient id="achievement-cup" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#fffaf0" /><stop offset="1" stopColor="#d8ccb4" /></linearGradient>
      </defs>
      <g transform="translate(1 3)">
        <path d="M31 7.5c-1.6-1.5.9-2.8-.5-4.4M35.5 7.5c-1.6-1.5.9-2.8-.5-4.4" fill="none" stroke="#e8e2d6" strokeWidth={1.1} strokeLinecap="round" opacity={0.7} />
        <path d="M26.5 12.5h15c1.4 6.5 1.6 13.5-2.6 19.3-3.6 5-10.4 7.2-16.6 5.6-4.3-1.1-8-3.4-11-6.4l2.3-2.5c2.9 2.4 6.3 3.9 9.8 3.9 3.3 0 5.5-1.8 5.4-5.2-.1-3.2-1.6-9.2-2.3-14.7z" fill="url(#achievement-gourd)" />
        <path d="M29.3 18c1.4 4.2 1.9 9.8.2 13" fill="none" stroke="#f6c47a" strokeWidth={1} strokeLinecap="round" opacity={0.55} />
        <path d="M26 9h16v3.6c0 1.6-16 1.6-16 0z" fill="url(#achievement-cup)" />
        <ellipse cx="34" cy="9" rx="8" ry="1.9" fill="#3a2a1c" />
        <ellipse cx="34" cy="9" rx="6.2" ry="1.1" fill="#e2602a" opacity={0.85} />
        <path d="M13.4 29.6 4.6 24.6" stroke="#141414" strokeWidth={2.6} strokeLinecap="round" />
        <path d="M12.4 31.3l2.4-2.6" stroke="#d9cdb6" strokeWidth={2.2} strokeLinecap="round" />
      </g>
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
