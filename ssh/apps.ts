// Full-screen programs that take over the terminal: the read-only vim viewer,
// snake, 2048 and the matrix rain. Each uses the alternate screen and hands the
// terminal back unchanged when it quits.
import { createSnake, step, turn, type Dir, type SnakeState } from '../src/games/snake'
import { addRandomTile, createBoard, hasMoves, maxTile, move, won, type Board } from '../src/games/twenty48'
import { search, type Pos } from '../src/shell/vim'
import { bg, fg, RESET, sgr, stripAnsi, width, wrap, type ColorDepth, type Palette, type RGB } from './ansi'
import type { Key } from './terminal'

export type Screen = { columns: number; rows: number; palette: Palette; depth: ColorDepth; write: (data: string) => void }
export type App = { key: (key: Key) => void; resize: () => void; stop: () => void }

const enter = '\x1b[?1049h\x1b[?25l\x1b[H\x1b[2J'
const leave = '\x1b[?25h\x1b[?1049l'
const at = (row: number, column: number) => `\x1b[${row};${column}H`
const directions: Record<string, Dir> = { up: 'up', down: 'down', left: 'left', right: 'right', w: 'up', s: 'down', a: 'left', d: 'right', k: 'up', j: 'down', h: 'left', l: 'right' }

function fullScreen(screen: Screen, onExit: () => void) {
  screen.write(enter)
  let done = false
  return { quit: () => { if (done) return; done = true; screen.write(leave); onExit() }, get done() { return done } }
}

// A read-only vim: motions, search, :q. Long lines wrap like vim's default.
export function viewer(screen: Screen, name: string, text: string, onExit: () => void): App {
  const session = fullScreen(screen, onExit)
  const source = text ? text.split('\n') : []
  let lines: string[] = []
  let top = 0
  let pending = ''
  let command: string | null = null
  let message = ''
  let pattern = ''
  const rebuild = () => { lines = source.flatMap((line) => wrap(line, screen.columns).map(stripAnsi)) }
  const page = () => Math.max(1, screen.rows - 1)
  const clampTop = () => { top = Math.max(0, Math.min(top, Math.max(0, lines.length - page()))) }
  const draw = () => {
    clampTop()
    let output = at(1, 1)
    for (let row = 0; row < page(); row++) {
      const line = lines[top + row]
      const shown = line === undefined ? `${screen.palette.accent}~${RESET}` : pattern && line.toLowerCase().includes(pattern.toLowerCase()) ? highlight(line) : line
      output += `${shown}\x1b[K\r\n`
    }
    const position = lines.length ? `${top + 1},1${' '.repeat(10)}${lines.length <= page() ? 'All' : top === 0 ? 'Top' : top >= lines.length - page() ? 'Bot' : `${Math.round((top / (lines.length - page())) * 100)}%`}` : '0,0-1         All'
    const status = command !== null ? `${command[0]}${command.slice(1)}` : message || `"${name || '[No Name]'}" [readonly] ${source.length}L`
    output += `${status}${' '.repeat(Math.max(1, screen.columns - width(status) - width(position) - 1))}${position}\x1b[K`
    screen.write(output)
  }
  const highlight = (line: string) => line.replace(new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), (match) => `${sgr('7')}${match}${RESET}`)
  const find = (backward: boolean) => {
    if (!pattern) return
    const hit: Pos | null = search(lines, { row: top, col: 0 }, pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), backward)
    if (hit && hit.row !== top) top = hit.row
    else if (!hit) message = `E486: Pattern not found: ${pattern}`
  }
  const run = (line: string) => {
    const input = line.slice(1).trim()
    if (line[0] === '/' || line[0] === '?') { pattern = input || pattern; find(line[0] === '?'); return }
    if (/^(q|q!|wq|wq!|x|qa|qa!)$/.test(input)) { session.quit(); return }
    if (/^w/.test(input)) { message = "E45: 'readonly' option is set (add ! to override)"; return }
    if (/^\d+$/.test(input)) { top = Number(input) - 1; return }
    message = `E492: Not an editor command: ${input}`
  }
  rebuild()
  draw()
  return {
    key(key) {
      if (session.done) return
      if (command !== null) {
        if (key.name === 'enter') { const line = command; command = null; run(line) }
        else if (key.name === 'escape' || (key.ctrl && key.name === 'c')) command = null
        else if (key.name === 'backspace') command = command.length > 1 ? command.slice(0, -1) : null
        else if (key.text && !key.ctrl && !key.alt) command += key.text
        if (!session.done) draw()
        return
      }
      message = ''
      const name = key.ctrl ? `^${key.name}` : key.name
      const half = Math.max(1, Math.floor(page() / 2))
      if (pending === 'g' && name === 'g') top = 0
      else if (pending === 'Z' && (name === 'Z' || name === 'Q')) { session.quit(); return }
      else if (name === 'j' || name === 'down' || name === 'enter' || name === '^e' || name === '^n') top++
      else if (name === 'k' || name === 'up' || name === '^y' || name === '^p') top--
      else if (name === '^d') top += half
      else if (name === '^u') top -= half
      else if (name === '^f' || name === ' ' || name === 'pagedown') top += page()
      else if (name === '^b' || name === 'pageup') top -= page()
      else if (name === 'G' || name === 'end') top = lines.length
      else if (name === 'home') top = 0
      else if (name === ':' || name === '/' || name === '?') command = name
      else if (name === 'n' || name === 'N') find(name === 'N')
      else if (name === 'q' || (key.ctrl && key.name === 'c')) { if (name === 'q') { session.quit(); return } message = 'Type  :q  and press <Enter> to exit' }
      else if ('iaoIAOR'.includes(name) && name.length === 1) message = 'E21: Cannot make changes, \'modifiable\' is off'
      pending = name === 'g' || name === 'Z' ? (pending === name ? '' : name) : ''
      draw()
    },
    resize() { rebuild(); draw() },
    stop: session.quit,
  }
}

export function snake(screen: Screen, onExit: () => void): App {
  const session = fullScreen(screen, onExit)
  let state: SnakeState = createSnake()
  let best = 0
  const fits = () => screen.columns >= state.width * 2 + 2 && screen.rows >= state.height + 4
  const draw = () => {
    if (!fits()) { screen.write(`${at(1, 1)}\x1b[2JMake the window at least ${state.width * 2 + 2}x${state.height + 4} to play. q quits.`); return }
    const left = Math.max(1, Math.floor((screen.columns - state.width * 2 - 2) / 2))
    const { accent, accent2, error, muted } = screen.palette
    let output = `${at(1, left)}${sgr('1')}snake${RESET}  score ${accent}${state.score}${RESET}  best ${best}\x1b[K`
    output += `${at(2, left)}${muted}┌${'─'.repeat(state.width * 2)}┐${RESET}`
    for (let y = 0; y < state.height; y++) {
      let row = `${muted}│${RESET}`
      for (let x = 0; x < state.width; x++) {
        const index = state.snake.findIndex((cell) => cell.x === x && cell.y === y)
        row += index === 0 ? `${accent}██${RESET}` : index > 0 ? `${accent2}██${RESET}` : state.food?.x === x && state.food.y === y ? `${error}●${RESET} ` : '  '
      }
      output += `${at(3 + y, left)}${row}${muted}│${RESET}`
    }
    output += `${at(3 + state.height, left)}${muted}└${'─'.repeat(state.width * 2)}┘${RESET}`
    output += `${at(4 + state.height, left)}${state.alive ? `${muted}arrows / WASD / hjkl · p pause · q quit${RESET}` : `${error}game over${RESET} · r to play again · q quit`}\x1b[K`
    screen.write(output)
  }
  let paused = false
  const timer = setInterval(() => {
    if (paused || !state.alive || !fits()) return
    state = step(state)
    best = Math.max(best, state.score)
    draw()
  }, 140)
  const quit = () => { clearInterval(timer); session.quit() }
  screen.write('\x1b[2J')
  draw()
  return {
    key(key) {
      if (key.name === 'q' || key.name === 'escape' || (key.ctrl && key.name === 'c')) { quit(); return }
      if (key.name === 'p') paused = !paused
      else if (key.name === 'r' && !state.alive) state = createSnake()
      else if (directions[key.name]) state = turn(state, directions[key.name]!)
      draw()
    },
    resize() { screen.write('\x1b[2J'); draw() },
    stop: quit,
  }
}

const tileColors: Record<number, RGB> = { 2: [238, 228, 218], 4: [237, 224, 200], 8: [242, 177, 121], 16: [245, 149, 99], 32: [246, 124, 95], 64: [246, 94, 59], 128: [237, 207, 114], 256: [237, 204, 97], 512: [237, 200, 80], 1024: [237, 197, 63], 2048: [237, 194, 46] }

export function twenty48(screen: Screen, onExit: () => void): App {
  const session = fullScreen(screen, onExit)
  let board: Board = createBoard()
  let score = 0
  let keepGoing = false
  const cell = 7
  const draw = () => {
    const boardWidth = cell * 4 + 5
    if (screen.columns < boardWidth || screen.rows < 20) { screen.write(`${at(1, 1)}\x1b[2JMake the window at least ${boardWidth}x20 to play. q quits.`); return }
    const left = Math.max(1, Math.floor((screen.columns - boardWidth) / 2))
    const { muted, accent, error } = screen.palette
    let output = `${at(1, left)}${sgr('1')}2048${RESET}  score ${accent}${score}${RESET}  best tile ${maxTile(board)}\x1b[K`
    board.forEach((row, r) => {
      for (let line = 0; line < 3; line++) {
        output += at(3 + r * 4 + line, left)
        row.forEach((value) => {
          const color = tileColors[Math.min(2048, value)] ?? [60, 58, 50]
          const label = line === 1 && value ? String(value) : ''
          const pad = cell - label.length
          output += ` ${value ? bg(color, screen.depth) + fg(value > 4 ? [249, 246, 242] : [119, 110, 101], screen.depth) + sgr('1') : sgr('2')}${value ? ' '.repeat(Math.floor(pad / 2)) + label + ' '.repeat(Math.ceil(pad / 2)) : line === 1 ? '   ·   ' : ' '.repeat(cell)}${RESET}`
        })
      }
    })
    const over = !hasMoves(board)
    output += `${at(19, left)}${over ? `${error}no moves left${RESET} · r to restart · q quit` : won(board) && !keepGoing ? `${accent}2048!${RESET} keep going with the arrows · q quit` : `${muted}arrows / WASD / hjkl · r restart · q quit${RESET}`}\x1b[K`
    screen.write(output)
  }
  screen.write('\x1b[2J')
  draw()
  return {
    key(key) {
      if (key.name === 'q' || key.name === 'escape' || (key.ctrl && key.name === 'c')) { session.quit(); return }
      if (key.name === 'r') { board = createBoard(); score = 0; keepGoing = false }
      const dir = directions[key.name]
      if (dir) {
        if (won(board)) keepGoing = true
        const result = move(board, dir)
        if (result.moved) { board = addRandomTile(result.board); score += result.gained }
      }
      draw()
    },
    resize() { screen.write('\x1b[2J'); draw() },
    stop: session.quit,
  }
}

const glyphs = 'ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ0123456789'
const randomGlyph = () => glyphs[Math.floor(Math.random() * glyphs.length)]!

// Falling glyphs until any key (or half a minute) ends it.
export function matrix(screen: Screen, onExit: () => void): App {
  const session = fullScreen(screen, onExit)
  // Half-width katakana are one cell wide in most terminals; use every other column for safety.
  let drops: number[] = []
  const reset = () => { drops = Array.from({ length: Math.ceil(screen.columns / 2) }, () => -Math.floor(Math.random() * screen.rows)) }
  reset()
  const green: RGB = [57, 255, 20]
  const timer = setInterval(() => {
    let output = ''
    drops.forEach((y, index) => {
      const column = index * 2 + 1
      if (y > 0 && y <= screen.rows) output += `${at(y, column)}${sgr('1')}${fg([200, 255, 200], screen.depth)}${randomGlyph()}${RESET}`
      if (y - 1 > 0 && y - 1 <= screen.rows) output += `${at(y - 1, column)}${fg(green, screen.depth)}${randomGlyph()}${RESET}`
      const tail = y - 12
      if (tail > 0 && tail <= screen.rows) output += `${at(tail, column)} `
      drops[index] = y > screen.rows + 12 && Math.random() > 0.9 ? 0 : y + 1
    })
    screen.write(output)
  }, 70)
  const quit = () => { clearInterval(timer); clearTimeout(limit); session.quit() }
  const limit = setTimeout(quit, 30_000)
  return { key: quit, resize() { screen.write('\x1b[2J'); reset() }, stop: quit }
}
