import { useEffect, useRef, useState } from 'react'
import { profile } from '../content'

export type MenuItem = { label: string; shortcut?: string; checked?: boolean; action?: () => void; separator?: false } | { separator: true }
export type Menu = { label: string; items: MenuItem[] }

function Clock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => { const timer = setInterval(() => setNow(new Date()), 15_000); return () => clearInterval(timer) }, [])
  return <span className="menubar-clock">{now.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}  {now.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}</span>
}

export function MenuBar({ menus, status }: { menus: Menu[]; status: string }) {
  const [open, setOpen] = useState<number | null>(null)
  const barRef = useRef<HTMLElement>(null)

  useEffect(() => {
    if (open === null) return
    const close = (event: PointerEvent) => { if (!barRef.current?.contains(event.target as Node)) setOpen(null) }
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(null) }
    window.addEventListener('pointerdown', close)
    window.addEventListener('keydown', escape)
    return () => { window.removeEventListener('pointerdown', close); window.removeEventListener('keydown', escape) }
  }, [open])

  return (
    <nav className="menubar" ref={barRef} aria-label="Terminal menu bar">
      <span className="menubar-logo" aria-hidden="true">&gt;{profile.initials}</span>
      <ul className="menubar-menus" role="menubar">
        {menus.map((menu, index) => (
          <li key={menu.label} className={`menubar-menu${index === 0 ? ' app-menu' : ''}`} role="none">
            <button
              type="button"
              role="menuitem"
              aria-haspopup="true"
              aria-expanded={open === index}
              className={open === index ? 'active' : ''}
              onClick={() => setOpen(open === index ? null : index)}
              onPointerEnter={() => { if (open !== null) setOpen(index) }}
            >{menu.label}</button>
            {open === index && (
              <ul className="menu-dropdown" role="menu">
                {menu.items.map((item, itemIndex) => item.separator
                  ? <li key={`sep-${itemIndex}`} className="menu-separator" role="separator" />
                  : (
                    <li key={item.label} role="none">
                      <button type="button" role="menuitem" onClick={() => { setOpen(null); item.action?.() }}>
                        <span className="menu-check">{item.checked ? '✓' : ''}</span>
                        <span className="menu-label">{item.label}</span>
                        {item.shortcut && <span className="menu-shortcut">{item.shortcut}</span>}
                      </button>
                    </li>
                  ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
      <span className="menubar-right">
        {status && <span className="menubar-status">{status}</span>}
        <span className="menubar-ssh" title="Connected over SSH">⚡ ssh</span>
        <Clock />
      </span>
    </nav>
  )
}
