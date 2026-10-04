import { useCallback, useEffect, useReducer, useRef, useState, type CSSProperties, type PointerEvent } from 'react'
import { createSnake, step, turn, type Dir, type SnakeState } from '../games/snake'
import { addRandomTile, createBoard, hasMoves, maxTile, move, won, type Board } from '../games/twenty48'
import './Games.css'

export type GameName = 'snake' | '2048'

const bestKey = (game: GameName) => `portfolio.best.${game}`
const readBest = (game: GameName) => {
  try { return Number(localStorage.getItem(bestKey(game))) || 0 } catch { return 0 }
}
const writeBest = (game: GameName, value: number) => {
  try { localStorage.setItem(bestKey(game), String(value)) } catch { /* storage unavailable */ }
}

const dirKeys: Record<string, Dir> = {
  arrowup: 'up', w: 'up', k: 'up',
  arrowdown: 'down', s: 'down', j: 'down',
  arrowleft: 'left', a: 'left', h: 'left',
  arrowright: 'right', d: 'right', l: 'right',
}
const plainKey = (event: KeyboardEvent) => !event.metaKey && !event.ctrlKey && !event.altKey
const sequence = (rolls: number[]) => { let i = 0; return () => rolls[i++] ?? Math.random() }

function useSwipe(onSwipe: (dir: Dir) => void, onTap?: () => void) {
  const start = useRef<{ x: number; y: number } | null>(null)
  return {
    onPointerDown: (event: PointerEvent<HTMLElement>) => { start.current = { x: event.clientX, y: event.clientY } },
    onPointerCancel: () => { start.current = null },
    onPointerUp: (event: PointerEvent<HTMLElement>) => {
      const origin = start.current
      start.current = null
      if (!origin) return
      const dx = event.clientX - origin.x
      const dy = event.clientY - origin.y
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return onTap?.()
      onSwipe(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'))
    },
  }
}

export function GameOverlay({ game, onExit }: { game: GameName; onExit: (summary: string) => void }) {
  const [score, setScore] = useState(0)
  const [best, setBest] = useState(() => readBest(game))
  const scoreRef = useRef(0)
  const bestRef = useRef(best)
  const panelRef = useRef<HTMLDivElement>(null)

  const report = useCallback((value: number) => {
    scoreRef.current = value
    setScore(value)
    if (value > bestRef.current) {
      bestRef.current = value
      setBest(value)
      writeBest(game, value)
    }
  }, [game])

  const exit = useCallback(() => onExit(`${game}: score ${scoreRef.current} (best ${bestRef.current})`), [game, onExit])

  useEffect(() => {
    panelRef.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (!plainKey(event)) return
      const key = event.key.toLowerCase()
      if (key === 'q' || key === 'escape') { event.preventDefault(); exit() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [exit])

  return (
    <div className="game-backdrop">
      <div ref={panelRef} className="game-panel" role="dialog" aria-modal="true" aria-label={game === 'snake' ? 'Snake game' : '2048 game'} tabIndex={-1}>
        <header className="game-chrome">
          <span className="game-title">~/games/{game}</span>
          <span className="game-score">score <b>{score}</b></span>
          <span className="game-score">best <b>{best}</b></span>
          <button type="button" className="game-close" onClick={exit} aria-label="Close game">×</button>
        </header>
        {game === 'snake' ? <SnakeGame report={report} /> : <Twenty48Game report={report} />}
      </div>
    </div>
  )
}

type SnakeAction = { type: 'turn'; dir: Dir } | { type: 'tick'; roll: number } | { type: 'pause' } | { type: 'restart'; roll: number }
type SnakeView = { game: SnakeState; paused: boolean; started: boolean }

const snakeReducer = (state: SnakeView, action: SnakeAction): SnakeView => {
  switch (action.type) {
    case 'turn': return state.game.alive ? { game: turn(state.game, action.dir), paused: false, started: true } : state
    case 'tick': return state.paused ? state : { ...state, game: step(state.game, () => action.roll) }
    case 'pause': return state.game.alive && state.started ? { ...state, paused: !state.paused } : state
    case 'restart': return { game: createSnake(() => action.roll), paused: true, started: false }
  }
}

function SnakeGame({ report }: { report: (score: number) => void }) {
  const [state, dispatch] = useReducer(snakeReducer, undefined, () => ({ game: createSnake(), paused: true, started: false }))
  const { game, paused, started } = state
  const delay = Math.max(60, 120 - game.score * 3)

  useEffect(() => { report(game.score) }, [game.score, report])

  useEffect(() => {
    if (paused || !game.alive) return
    const timer = setInterval(() => dispatch({ type: 'tick', roll: Math.random() }), delay)
    return () => clearInterval(timer)
  }, [delay, paused, game.alive])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!plainKey(event)) return
      const key = event.key.toLowerCase()
      const dir = dirKeys[key]
      if (dir) dispatch({ type: 'turn', dir })
      else if (key === ' ' || key === 'p') dispatch({ type: 'pause' })
      else if (key === 'r') { if (!game.alive) dispatch({ type: 'restart', roll: Math.random() }) }
      else return
      event.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [game.alive])

  const swipe = useSwipe(
    dir => dispatch({ type: 'turn', dir }),
    () => dispatch(game.alive ? { type: 'pause' } : { type: 'restart', roll: Math.random() }),
  )

  const body = new Set(game.snake.map(cell => cell.y * game.width + cell.x))
  const head = game.snake[0]!
  const headIndex = head.y * game.width + head.x
  const foodIndex = game.food ? game.food.y * game.width + game.food.x : -1
  const status = !game.alive ? (game.food ? 'game over · r or tap to restart' : 'board cleared! · r to restart')
    : !started ? 'press a direction to start' : paused ? 'paused · space to resume' : ''

  return (
    <>
      <div className={`game-board game-snake${game.alive ? '' : ' dead'}`} style={{ '--cols': game.width, '--rows': game.height } as CSSProperties} {...swipe}>
        {Array.from({ length: game.width * game.height }, (_, index) => (
          <span key={index} className={index === headIndex ? 'game-cell head' : body.has(index) ? 'game-cell body' : index === foodIndex ? 'game-cell food' : 'game-cell'} />
        ))}
        {status && <div className="game-status" aria-live="polite">{status}</div>}
      </div>
      <p className="game-hint">arrows / wasd / hjkl or swipe · space pause · r restart · q quit</p>
    </>
  )
}

type Twenty48State = { board: Board; score: number; dismissed: boolean }
type Twenty48Action = { type: 'move'; dir: Dir; rolls: number[] } | { type: 'restart'; rolls: number[] }

const twenty48Reducer = (state: Twenty48State, action: Twenty48Action): Twenty48State => {
  if (action.type === 'restart') return { board: createBoard(sequence(action.rolls)), score: 0, dismissed: false }
  if (!hasMoves(state.board)) return state
  const result = move(state.board, action.dir)
  if (!result.moved) return state
  return { board: addRandomTile(result.board, sequence(action.rolls)), score: state.score + result.gained, dismissed: state.dismissed || won(state.board) }
}

const rolls = () => [Math.random(), Math.random(), Math.random(), Math.random()]

function Twenty48Game({ report }: { report: (score: number) => void }) {
  const [state, dispatch] = useReducer(twenty48Reducer, undefined, () => ({ board: createBoard(), score: 0, dismissed: false }))
  const { board, score, dismissed } = state
  const over = !hasMoves(board)
  const reached = won(board) && !dismissed

  useEffect(() => { report(score) }, [score, report])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!plainKey(event)) return
      const key = event.key.toLowerCase()
      const dir = dirKeys[key]
      if (dir) dispatch({ type: 'move', dir, rolls: rolls() })
      else if (key === 'r') dispatch({ type: 'restart', rolls: rolls() })
      else return
      event.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const swipe = useSwipe(dir => dispatch({ type: 'move', dir, rolls: rolls() }), over ? () => dispatch({ type: 'restart', rolls: rolls() }) : undefined)

  return (
    <>
      <div className="game-board game-2048" {...swipe}>
        {board.flatMap((row, r) => row.map((value, c) => {
          const level = value ? Math.log2(value) : 0
          return (
            <span
              key={`${r}-${c}-${value}`}
              className={`game-tile${value ? ' filled' : ''}${level >= 7 ? ' hot' : ''}${value >= 1024 ? ' small' : ''}`}
              style={{ '--tile-mix': `${Math.min(100, level * 9)}%` } as CSSProperties}
            >{value || ''}</span>
          )
        }))}
        {(over || reached) && (
          <div className="game-status" aria-live="polite">
            {over ? `no moves left · max tile ${maxTile(board)} · r to restart` : 'you reached 2048! keep going or r to restart'}
          </div>
        )}
      </div>
      <p className="game-hint">arrows / wasd / hjkl or swipe · r restart · q quit</p>
    </>
  )
}
