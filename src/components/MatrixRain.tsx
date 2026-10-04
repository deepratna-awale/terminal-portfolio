import { useEffect, useRef } from 'react'

export function MatrixRain({ onDone }: { onDone: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) return
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight }
    resize()
    const glyphs = 'ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄ01DEEPRATNA<>/{}$#'
    const size = 16
    const drops = Array.from({ length: Math.ceil(canvas.width / size) }, () => Math.random() * -50)
    let frame = 0
    const draw = () => {
      context.fillStyle = 'rgba(0, 0, 0, 0.08)'
      context.fillRect(0, 0, canvas.width, canvas.height)
      context.font = `${size}px monospace`
      drops.forEach((y, column) => {
        context.fillStyle = Math.random() > 0.975 ? '#d7ffe0' : '#39ff88'
        context.fillText(glyphs[Math.floor(Math.random() * glyphs.length)]!, column * size, y * size)
        drops[column] = y * size > canvas.height && Math.random() > 0.975 ? 0 : y + 1
      })
      frame = requestAnimationFrame(draw)
    }
    frame = requestAnimationFrame(draw)
    const stop = () => onDone()
    const timer = setTimeout(stop, 12_000)
    window.addEventListener('keydown', stop)
    window.addEventListener('pointerdown', stop)
    window.addEventListener('resize', resize)
    return () => {
      cancelAnimationFrame(frame)
      clearTimeout(timer)
      window.removeEventListener('keydown', stop)
      window.removeEventListener('pointerdown', stop)
      window.removeEventListener('resize', resize)
    }
  }, [onDone])

  return <canvas ref={canvasRef} className="matrix-rain" aria-hidden="true" />
}
