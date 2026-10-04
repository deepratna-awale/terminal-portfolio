import './TrafficLights.css'

// macOS window controls: glyphs appear when the group is hovered, and the
// green button shows outward arrows (inward when the window is maximized).
type Props = { onClose: () => void; onMinimize: () => void; onMaximize: () => void; maximized: boolean; name: string }

export function TrafficLights({ onClose, onMinimize, onMaximize, maximized, name }: Props) {
  return (
    <div className="traffic">
      <button type="button" className="traffic-btn close" aria-label={`Close ${name}`} title="Close" onClick={onClose}>
        <svg viewBox="0 0 12 12" aria-hidden="true"><path d="M3.6 3.6l4.8 4.8M8.4 3.6l-4.8 4.8" /></svg>
      </button>
      <button type="button" className="traffic-btn minimize" aria-label={`Minimize ${name}`} title="Minimize" onClick={onMinimize}>
        <svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2.8 6h6.4" /></svg>
      </button>
      <button type="button" className="traffic-btn maximize" aria-label={maximized ? `Restore ${name}` : `Maximize ${name}`} title={maximized ? 'Exit full size' : 'Enter full size'} onClick={onMaximize}>
        <svg viewBox="0 0 12 12" aria-hidden="true">
          {maximized
            ? <><path className="fill" d="M6.3 5.7V2.4l3.3 3.3z" /><path className="fill" d="M5.7 6.3v3.3L2.4 6.3z" /></>
            : <><path className="fill" d="M3.3 3.3h4.1L3.3 7.4z" /><path className="fill" d="M8.7 8.7H4.6l4.1-4.1z" /></>}
        </svg>
      </button>
    </div>
  )
}
