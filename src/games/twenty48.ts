export type Board = number[][]
export type Move = 'up' | 'down' | 'left' | 'right'
export type Rng = () => number

export const SIZE = 4

export const emptyBoard = (): Board => Array.from({ length: SIZE }, () => Array<number>(SIZE).fill(0))
const clone = (board: Board): Board => board.map(row => [...row])

export function addRandomTile(board: Board, rng: Rng = Math.random): Board {
  const free: [number, number][] = []
  board.forEach((row, r) => row.forEach((value, c) => { if (!value) free.push([r, c]) }))
  if (!free.length) return board
  const [r, c] = free[Math.min(free.length - 1, Math.floor(rng() * free.length))]!
  const next = clone(board)
  next[r]![c] = rng() < 0.9 ? 2 : 4
  return next
}

export const createBoard = (rng: Rng = Math.random): Board => addRandomTile(addRandomTile(emptyBoard(), rng), rng)

export function slideLine(line: number[]): { line: number[]; gained: number } {
  const tiles = line.filter(Boolean)
  const out: number[] = []
  let gained = 0
  for (let i = 0; i < tiles.length; i++) {
    if (tiles[i] === tiles[i + 1]) {
      const merged = tiles[i]! * 2
      out.push(merged)
      gained += merged
      i++
    } else out.push(tiles[i]!)
  }
  while (out.length < line.length) out.push(0)
  return { line: out, gained }
}

const transpose = (board: Board): Board => board[0]!.map((_, c) => board.map(row => row[c]!))
const reverse = (board: Board): Board => board.map(row => [...row].reverse())

export function move(board: Board, dir: Move): { board: Board; moved: boolean; gained: number } {
  const vertical = dir === 'up' || dir === 'down'
  const backward = dir === 'right' || dir === 'down'
  let work = vertical ? transpose(board) : clone(board)
  if (backward) work = reverse(work)
  let gained = 0
  work = work.map(row => { const result = slideLine(row); gained += result.gained; return result.line })
  if (backward) work = reverse(work)
  if (vertical) work = transpose(work)
  const moved = work.some((row, r) => row.some((value, c) => value !== board[r]![c]))
  return { board: moved ? work : board, moved, gained }
}

export function hasMoves(board: Board): boolean {
  return board.some((row, r) => row.some((value, c) => !value || value === row[c + 1] || value === board[r + 1]?.[c]))
}

export const won = (board: Board, target = 2048) => board.some(row => row.some(value => value >= target))
export const maxTile = (board: Board) => Math.max(...board.flat())
