import { describe, expect, it } from 'vitest'
import { createSnake, step, turn, type SnakeState } from './snake'
import { addRandomTile, createBoard, emptyBoard, hasMoves, move, slideLine, won, type Board } from './twenty48'

const zero = () => 0

const snakeAt = (overrides: Partial<SnakeState>): SnakeState => ({ ...createSnake(zero), ...overrides })

describe('snake', () => {
  it('starts alive with food off the snake', () => {
    const state = createSnake(zero)
    expect(state.alive).toBe(true)
    expect(state.snake).toHaveLength(3)
    expect(state.snake.some(cell => cell.x === state.food!.x && cell.y === state.food!.y)).toBe(false)
  })

  it('ignores 180 degree reversals', () => {
    const state = createSnake(zero)
    expect(turn(state, 'left').queued).toBe('right')
    const up = turn(state, 'up')
    expect(up.queued).toBe('up')
    const moved = step(up, zero)
    expect(turn(moved, 'down').queued).toBe('up')
  })

  it('does not reverse via two quick turns in one tick', () => {
    const state = turn(createSnake(zero), 'up')
    expect(turn(state, 'left').queued).toBe('up')
    expect(step(turn(state, 'left'), zero).alive).toBe(true)
  })

  it('moves forward one cell', () => {
    const state = snakeAt({ snake: [{ x: 5, y: 5 }, { x: 4, y: 5 }, { x: 3, y: 5 }], food: { x: 0, y: 0 } })
    const next = step(state, zero)
    expect(next.snake).toEqual([{ x: 6, y: 5 }, { x: 5, y: 5 }, { x: 4, y: 5 }])
    expect(next.score).toBe(0)
  })

  it('grows and scores on food and places new food on a free cell', () => {
    const state = snakeAt({ snake: [{ x: 5, y: 5 }, { x: 4, y: 5 }, { x: 3, y: 5 }], food: { x: 6, y: 5 } })
    const next = step(state, zero)
    expect(next.snake).toHaveLength(4)
    expect(next.snake[0]).toEqual({ x: 6, y: 5 })
    expect(next.score).toBe(1)
    expect(next.food).toEqual({ x: 0, y: 0 })
    expect(next.snake.some(cell => cell.x === next.food!.x && cell.y === next.food!.y)).toBe(false)
  })

  it('dies on wall collision', () => {
    const state = snakeAt({ snake: [{ x: 19, y: 5 }, { x: 18, y: 5 }, { x: 17, y: 5 }], food: { x: 0, y: 0 } })
    const next = step(state, zero)
    expect(next.alive).toBe(false)
    expect(step(next, zero)).toBe(next)
  })

  it('dies on self collision', () => {
    const snake = [{ x: 5, y: 5 }, { x: 6, y: 5 }, { x: 6, y: 6 }, { x: 5, y: 6 }, { x: 4, y: 6 }]
    const state = snakeAt({ snake, dir: 'left', queued: 'left', food: { x: 0, y: 0 } })
    expect(step(turn(state, 'down'), zero).alive).toBe(false)
  })

  it('can follow its own tail', () => {
    const snake = [{ x: 5, y: 5 }, { x: 6, y: 5 }, { x: 6, y: 6 }, { x: 5, y: 6 }]
    const state = snakeAt({ snake, dir: 'left', queued: 'down', food: { x: 0, y: 0 } })
    expect(step(state, zero).alive).toBe(true)
  })
})

describe('2048', () => {
  const left = (row: number[]) => move([row, [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]], 'left').board[0]

  it('merges each tile at most once per move', () => {
    expect(left([2, 2, 2, 2])).toEqual([4, 4, 0, 0])
    expect(left([2, 2, 4, 0])).toEqual([4, 4, 0, 0])
    expect(left([4, 4, 8, 8])).toEqual([8, 16, 0, 0])
    expect(left([2, 0, 0, 2])).toEqual([4, 0, 0, 0])
    expect(left([2, 2, 2, 0])).toEqual([4, 2, 0, 0])
    expect(slideLine([8, 0, 8, 8]).gained).toBe(16)
  })

  it('moves in every direction', () => {
    const board: Board = [[2, 0, 0, 2], [0, 0, 0, 0], [0, 0, 0, 0], [2, 0, 0, 0]]
    expect(move(board, 'right').board[0]).toEqual([0, 0, 0, 4])
    const up = move(board, 'up')
    expect(up.board.map(row => row[0])).toEqual([4, 0, 0, 0])
    expect(up.gained).toBe(4)
    expect(move(board, 'down').board.map(row => row[0])).toEqual([0, 0, 0, 4])
  })

  it('reports no-op moves', () => {
    const board: Board = [[2, 4, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]
    const result = move(board, 'left')
    expect(result.moved).toBe(false)
    expect(result.gained).toBe(0)
    expect(result.board).toBe(board)
  })

  it('detects when no moves remain', () => {
    const stuck: Board = [[2, 4, 2, 4], [4, 2, 4, 2], [2, 4, 2, 4], [4, 2, 4, 2]]
    expect(hasMoves(stuck)).toBe(false)
    for (const dir of ['up', 'down', 'left', 'right'] as const) expect(move(stuck, dir).moved).toBe(false)
    expect(hasMoves([[2, 4, 2, 4], [4, 2, 4, 2], [2, 4, 2, 4], [4, 2, 4, 4]])).toBe(true)
    expect(hasMoves([[2, 4, 2, 4], [4, 2, 4, 2], [2, 4, 2, 4], [4, 2, 4, 0]])).toBe(true)
    expect(hasMoves([[2, 4, 2, 4], [4, 2, 4, 2], [2, 4, 8, 4], [4, 2, 8, 2]])).toBe(true)
  })

  it('adds 2s and 4s on free cells', () => {
    expect(addRandomTile(emptyBoard(), () => 0)[0]![0]).toBe(2)
    const values = [0, 0.95]
    expect(addRandomTile(emptyBoard(), () => values.shift()!)[0]![0]).toBe(4)
    expect(createBoard(zero).flat().filter(Boolean)).toHaveLength(2)
  })

  it('detects a win', () => {
    expect(won([[2048, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]])).toBe(true)
    expect(won(emptyBoard())).toBe(false)
  })
})
