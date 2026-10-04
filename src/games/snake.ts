export type Dir = 'up' | 'down' | 'left' | 'right'
export type Cell = { x: number; y: number }
export type Rng = () => number

export type SnakeState = {
  width: number
  height: number
  snake: Cell[]
  dir: Dir
  queued: Dir
  food: Cell | null
  score: number
  alive: boolean
}

export const SNAKE_WIDTH = 20
export const SNAKE_HEIGHT = 14

const delta: Record<Dir, Cell> = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } }
const opposite: Record<Dir, Dir> = { up: 'down', down: 'up', left: 'right', right: 'left' }
const same = (a: Cell, b: Cell) => a.x === b.x && a.y === b.y

export function placeFood(snake: Cell[], width: number, height: number, rng: Rng = Math.random): Cell | null {
  const free: Cell[] = []
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (!snake.some(cell => cell.x === x && cell.y === y)) free.push({ x, y })
  if (!free.length) return null
  return free[Math.min(free.length - 1, Math.floor(rng() * free.length))]!
}

export function createSnake(rng: Rng = Math.random, width = SNAKE_WIDTH, height = SNAKE_HEIGHT): SnakeState {
  const y = Math.floor(height / 2)
  const x = Math.floor(width / 3)
  const snake = [{ x, y }, { x: x - 1, y }, { x: x - 2, y }]
  return { width, height, snake, dir: 'right', queued: 'right', food: placeFood(snake, width, height, rng), score: 0, alive: true }
}

export function turn(state: SnakeState, dir: Dir): SnakeState {
  if (!state.alive || dir === opposite[state.dir] || dir === state.queued) return state
  return { ...state, queued: dir }
}

export function step(state: SnakeState, rng: Rng = Math.random): SnakeState {
  if (!state.alive) return state
  const dir = state.queued
  const head = state.snake[0]!
  const next = { x: head.x + delta[dir].x, y: head.y + delta[dir].y }
  const eats = state.food !== null && same(next, state.food)
  const body = eats ? state.snake : state.snake.slice(0, -1)
  if (next.x < 0 || next.y < 0 || next.x >= state.width || next.y >= state.height || body.some(cell => same(cell, next)))
    return { ...state, dir, alive: false }
  const snake = [next, ...body]
  if (!eats) return { ...state, snake, dir }
  const food = placeFood(snake, state.width, state.height, rng)
  return { ...state, snake, dir, food, score: state.score + 1, alive: food !== null }
}
