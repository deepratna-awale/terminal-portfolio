import { useEffect, useState } from 'react'
import './MobileKeys.css'

// Phones have no Tab, arrows or Ctrl, and no room for a completion list, so
// this strip sits on top of the on-screen keyboard: live completions as chips
// (tap one to take it) followed by the missing keys.

export type MobileKey = 'Tab' | 'Up' | 'Down' | 'Esc'
type Props = { candidates: string[]; onPick: (choice: string) => void; onKey: (key: MobileKey) => void; ctrl: boolean; onCtrl: () => void }

// Distance from the bottom of the layout viewport to the top of the keyboard.
function useKeyboardInset() {
  const [inset, setInset] = useState(0)
  useEffect(() => {
    const viewport = window.visualViewport
    if (!viewport) return
    const update = () => setInset(Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop))
    update()
    viewport.addEventListener('resize', update)
    viewport.addEventListener('scroll', update)
    return () => { viewport.removeEventListener('resize', update); viewport.removeEventListener('scroll', update) }
  }, [])
  return inset
}

export function MobileKeys({ candidates, onPick, onKey, ctrl, onCtrl }: Props) {
  const inset = useKeyboardInset()
  // Buttons must not steal focus from the input, or the keyboard would close.
  const keep = (event: React.PointerEvent | React.MouseEvent) => event.preventDefault()
  return (
    <div className="mobile-keys" style={{ bottom: inset }} role="toolbar" aria-label="Completions and terminal keys">
      <div className="mobile-chips">
        {candidates.slice(0, 30).map((choice) => (
          <button key={choice} type="button" className="mobile-chip" onPointerDown={keep} onMouseDown={keep} onClick={() => onPick(choice)}>{choice}</button>
        ))}
      </div>
      <div className="mobile-special">
        <button type="button" onPointerDown={keep} onMouseDown={keep} onClick={() => onKey('Tab')} aria-label="Tab">⇥</button>
        <button type="button" onPointerDown={keep} onMouseDown={keep} onClick={() => onKey('Up')} aria-label="Previous command">↑</button>
        <button type="button" onPointerDown={keep} onMouseDown={keep} onClick={() => onKey('Down')} aria-label="Next command">↓</button>
        <button type="button" className={ctrl ? 'armed' : ''} aria-pressed={ctrl} onPointerDown={keep} onMouseDown={keep} onClick={onCtrl} aria-label="Control: the next letter is sent with Ctrl">^</button>
        <button type="button" onPointerDown={keep} onMouseDown={keep} onClick={() => onKey('Esc')} aria-label="Escape">esc</button>
      </div>
    </div>
  )
}
