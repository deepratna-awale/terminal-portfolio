import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react'
import { os, profile } from '../content'
import { DINO, NEWTAB, URLS, VERSION, chromePages } from '../gui/address'
import { DINO_WIDTH, DINO_X, REX, createDino, jump, score, stepDino, type DinoState } from '../games/dino'

type Go = (url: string) => void
const HEIGHT = 150
const GROUND = 128
const BEST = 'dino-best'
const readBest = () => { try { return Number(localStorage.getItem(BEST)) || 0 } catch { return 0 } }
const saveBest = (value: number) => { try { localStorage.setItem(BEST, String(value)) } catch { /* storage unavailable */ } }

// 20x22 T-rex, two running frames for the legs.
const BODY = [
  '           ########',
  '          ##.#######',
  '          ##########',
  '          ##########',
  '          #####',
  '          ########',
  '#        #####',
  '#       #######',
  '##     #########',
  '###   ##########  #',
  '##############',
  '#############',
  ' ###########',
  '  #########',
  '   #######',
]
const LEGS = [['    ###  ##', '    ##    #', '    #     ##'], ['    ##   ##', '    ###   #', '          ##']]
const PX = 2

function drawRex(ctx: CanvasRenderingContext2D, x: number, top: number, frame: number, dead: boolean) {
  const rows = [...BODY, ...LEGS[frame]!]
  rows.forEach((row, y) => [...row].forEach((cell, col) => {
    if (cell === '#' || (cell === '.' && dead)) ctx.fillRect(x + col * PX, top + y * PX, PX, PX)
  }))
}

function drawCacti(ctx: CanvasRenderingContext2D, x: number, width: number, height: number) {
  const each = width >= 25 && width % 25 === 0 ? 25 : 17
  for (let left = x; left < x + width; left += each) {
    const trunk = Math.round(each * 0.36)
    const mid = left + (each - trunk) / 2
    ctx.fillRect(mid, GROUND - height, trunk, height)
    ctx.fillRect(left, GROUND - height * 0.7, 3, height * 0.32)
    ctx.fillRect(left, GROUND - height * 0.42, mid - left, 3)
    ctx.fillRect(left + each - 3, GROUND - height * 0.8, 3, height * 0.36)
    ctx.fillRect(mid + trunk, GROUND - height * 0.48, left + each - mid - trunk, 3)
  }
}

export function DinoPage() {
  const root = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const game = useRef<DinoState | null>(null)
  const [best, setBest] = useState(readBest)
  const [playing, setPlaying] = useState(false)

  const press = () => {
    if (!game.current || !game.current.alive) { game.current = jump(createDino()); setPlaying(true) }
    else game.current = jump(game.current)
  }

  useEffect(() => { root.current?.focus({ preventScroll: true }) }, [])
  useEffect(() => {
    const ctx = canvas.current?.getContext('2d')
    if (!ctx) return
    let frame = 0
    let last = performance.now()
    let ended = false
    const draw = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const state = game.current
      if (state?.alive) game.current = stepDino(state, dt)
      const current = game.current ?? createDino()
      const ink = getComputedStyle(canvas.current!).color
      ctx.clearRect(0, 0, DINO_WIDTH, HEIGHT)
      ctx.fillStyle = ink
      ctx.fillRect(0, GROUND - 1, DINO_WIDTH, 1)
      for (let x = -current.distance % 60; x < DINO_WIDTH; x += 60) ctx.fillRect(x + 60, GROUND + 6, 3, 1)
      current.cacti.forEach((cactus) => drawCacti(ctx, cactus.x, cactus.width, cactus.height))
      const legs = current.y > 0 || !game.current ? 0 : Math.floor(current.distance / 30) % 2
      drawRex(ctx, DINO_X, GROUND - REX.height - current.y + 1, legs, !current.alive)
      ctx.font = '12px ui-monospace, monospace'
      ctx.textAlign = 'right'
      const points = score(current)
      ctx.fillText(`HI ${String(Math.max(best, points)).padStart(5, '0')}  ${String(points).padStart(5, '0')}`, DINO_WIDTH - 8, 20)
      if (!current.alive && !ended) {
        ended = true
        if (points > best) { saveBest(points); setBest(points) }
        setPlaying(false)
      }
      if (!current.alive) { ctx.textAlign = 'center'; ctx.fillText('G A M E   O V E R', DINO_WIDTH / 2, 60) }
      if (current.alive) ended = false
      frame = requestAnimationFrame(draw)
    }
    frame = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(frame)
  }, [best])

  return (
    <div
      className="cb-chrome cb-dino"
      ref={root}
      tabIndex={0}
      aria-label="Dinosaur game. Press space or tap to jump."
      onPointerDown={(event) => { if (event.button === 0) { event.currentTarget.focus(); press() } }}
      onKeyDown={(event) => { if (event.key === ' ' || event.key === 'ArrowUp' || event.key === 'Enter') { event.preventDefault(); press() } }}
    >
      <canvas ref={canvas} width={DINO_WIDTH} height={HEIGHT} />
      <p>{playing ? 'Space or tap to jump' : 'Press space or tap to play'}</p>
    </div>
  )
}

const internalLink = (go: Go, url: string) => (event: ReactMouseEvent) => { event.preventDefault(); go(url) }

export function VersionPage({ go }: { go: Go }) {
  const agent = typeof navigator === 'undefined' ? '' : navigator.userAgent
  const rows: [string, string][] = [
    [`${os.name} Chrome`, `${os.version.replace(/\s.*$/, '')} (Official Build) (64-bit)`],
    ['Revision', 'works on my machine'],
    ['OS', `${os.name} ${os.version}`],
    ['JavaScript', 'V8, running in your actual browser'],
    ['User agent', agent],
    ['Command line', `chrome --guest --no-first-run ${profile.host}/gui`],
    ['Profile path', 'Guest (nothing is saved here)'],
  ]
  return (
    <div className="cb-chrome cb-version">
      <h1><img src="/favicon.svg" alt="" width={32} height={32} /> About Version</h1>
      <table><tbody>{rows.map(([key, value]) => <tr key={key}><th scope="row">{key}</th><td>{value}</td></tr>)}</tbody></table>
      <p>Looking for something else? Try <a href={URLS} onClick={internalLink(go, URLS)}>{URLS}</a>.</p>
    </div>
  )
}

export function UrlsPage({ go }: { go: Go }) {
  return (
    <div className="cb-chrome cb-urls">
      <h1>List of Chrome URLs</h1>
      <ul>{Object.keys(chromePages).filter((url) => url !== URLS).map((url) => <li key={url}><a href={url} onClick={internalLink(go, url)}>{url}</a></li>)}</ul>
      <h2>For debug</h2>
      <p>Some searches work here the way they do on Google. Try one in the address bar: <code>do a barrel roll</code>, <code>askew</code>, <code>flip a coin</code> or <code>roll a die</code>.</p>
    </div>
  )
}

export function IncognitoPage({ go }: { go: Go }) {
  return (
    <div className="cb-chrome cb-incognito">
      <svg viewBox="0 0 48 48" width={72} height={72} aria-hidden="true"><path fill="currentColor" d="M17 9h14l4 10H13zM6 21h36v3H6zm9 7a6 6 0 1 1 0 12 6 6 0 0 1 0-12zm18 0a6 6 0 1 1 0 12 6 6 0 0 1 0-12zm-12 4.5h6v3h-6z" /></svg>
      <h1>You've gone Incognito</h1>
      <p>Well, sort of. You were already browsing as a guest: this site sets no cookies and runs no trackers, so there was not much to hide.</p>
      <p>The only things it remembers are on your own device, like your theme, terminal history and your <a href={DINO} onClick={internalLink(go, DINO)}>dino high score</a>.</p>
      <p><a href={NEWTAB} onClick={internalLink(go, NEWTAB)}>Open a regular new tab</a> or check <a href={VERSION} onClick={internalLink(go, VERSION)}>{VERSION}</a>.</p>
    </div>
  )
}
