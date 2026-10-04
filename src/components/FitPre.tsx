import { useLayoutEffect, useRef, type ReactNode } from 'react'

// Preformatted text (ASCII art, cowthink, graphs) shown whole: the font shrinks
// until the widest line fits. Past MIN_SCALE it would be unreadable, so lines
// wrap instead of scrolling.
const MIN_SCALE = 0.42

export function FitPre({ className, children }: { className?: string; children: ReactNode }) {
  const ref = useRef<HTMLPreElement>(null)

  useLayoutEffect(() => {
    const pre = ref.current
    const container = pre?.parentElement
    if (!pre || !container) return
    const fit = () => {
      pre.style.fontSize = ''
      pre.style.whiteSpace = 'pre'
      const available = pre.clientWidth
      const needed = pre.scrollWidth
      if (!available || needed <= available + 1) return
      const scale = available / needed
      const base = parseFloat(getComputedStyle(pre).fontSize)
      if (scale >= MIN_SCALE) pre.style.fontSize = `${Math.floor(base * scale * 100) / 100}px`
      else { pre.style.fontSize = `${base * MIN_SCALE}px`; pre.style.whiteSpace = 'pre-wrap' }
    }
    fit()
    const observer = new ResizeObserver(fit)
    observer.observe(container)
    document.fonts?.ready.then(fit).catch(() => {})
    return () => observer.disconnect()
  }, [children])

  return <pre ref={ref} className={className}>{children}</pre>
}
