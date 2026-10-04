// Shows the pre-rendered images (ssh/build-images.mjs) in the visitor's
// terminal: kitty graphics, iTerm2 inline images, sixel, coloured half blocks
// or, as a last resort, ASCII art.
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { bg, fg, RESET, type ColorDepth, type RGB } from './ansi'
import type { ImageMode } from './terminal'

type Asset = { png: string; width: number; height: number; sixel: string; grid: { file: string; width: number; height: number } }
export type Grid = { width: number; height: number; data: Uint8Array }

let directory = process.env.SSH_IMAGES_DIR ?? ''
let manifest: Record<string, Asset> | null = null
const files = new Map<string, Buffer>()

export function useImageDirectory(path: string) { directory = path; manifest = null; files.clear() }

function assets(): Record<string, Asset> {
  if (manifest) return manifest
  const file = join(directory, 'manifest.json')
  manifest = directory && existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as Record<string, Asset>) : {}
  return manifest
}

function read(name: string): Buffer {
  let data = files.get(name)
  if (!data) { data = readFileSync(join(directory, name)); files.set(name, data) }
  return data
}

export const hasImage = (src: string) => Boolean(assets()[src])

// Box-averages the grid down to `columns` pixels wide.
export function scale(grid: Grid, columns: number, rowsPerCell: 1 | 2): Grid {
  const width = Math.max(1, Math.min(columns, grid.width))
  const step = grid.width / width
  // Terminal cells are about twice as tall as wide.
  let height = Math.max(rowsPerCell, Math.round(grid.height / step / (rowsPerCell === 2 ? 1 : 2)))
  if (rowsPerCell === 2 && height % 2) height++
  const stepY = grid.height / height
  const data = new Uint8Array(width * height * 3)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const x0 = Math.floor(x * step)
      const x1 = Math.max(x0 + 1, Math.floor((x + 1) * step))
      const y0 = Math.floor(y * stepY)
      const y1 = Math.max(y0 + 1, Math.floor((y + 1) * stepY))
      const sum = [0, 0, 0]
      let count = 0
      for (let sy = y0; sy < Math.min(y1, grid.height); sy++) {
        for (let sx = x0; sx < Math.min(x1, grid.width); sx++) {
          const offset = (sy * grid.width + sx) * 3
          sum[0] += grid.data[offset]!; sum[1] += grid.data[offset + 1]!; sum[2] += grid.data[offset + 2]!
          count++
        }
      }
      for (let channel = 0; channel < 3; channel++) data[(y * width + x) * 3 + channel] = Math.round(sum[channel]! / Math.max(1, count))
    }
  }
  return { width, height, data }
}

const pixel = (grid: Grid, x: number, y: number): RGB => {
  const offset = (y * grid.width + x) * 3
  return [grid.data[offset]!, grid.data[offset + 1]!, grid.data[offset + 2]!]
}

// Upper half block: the foreground paints the top pixel, the background the bottom one.
export function halfBlocks(grid: Grid, depth: ColorDepth): string[] {
  const lines: string[] = []
  for (let y = 0; y < grid.height; y += 2) {
    let line = ''
    for (let x = 0; x < grid.width; x++) line += fg(pixel(grid, x, y), depth) + bg(pixel(grid, x, Math.min(y + 1, grid.height - 1)), depth) + '▀'
    lines.push(line + RESET)
  }
  return lines
}

const ramp = ' .:-=+*#%@'
export function ascii(grid: Grid): string[] {
  const lines: string[] = []
  for (let y = 0; y < grid.height; y++) {
    let line = ''
    for (let x = 0; x < grid.width; x++) {
      const [r, g, b] = pixel(grid, x, y)
      line += ramp[Math.min(ramp.length - 1, Math.floor(((0.2126 * r + 0.7152 * g + 0.0722 * b) / 256) * ramp.length))]
    }
    lines.push(line.trimEnd())
  }
  return lines
}

function kitty(png: Buffer, columns: number): string {
  const data = png.toString('base64')
  const chunks = data.match(/.{1,4096}/g) ?? []
  return chunks.map((chunk, index) => `\x1b_G${index === 0 ? `a=T,f=100,q=2,c=${columns},` : ''}m=${index === chunks.length - 1 ? 0 : 1};${chunk}\x1b\\`).join('')
}

const iterm = (png: Buffer, columns: number) => `\x1b]1337;File=inline=1;size=${png.length};width=${columns};preserveAspectRatio=1:${png.toString('base64')}\x07`

// Returns the text to write (with \r\n line ends), or null when there is no such image.
export function renderImage(src: string, mode: ImageMode, columns: number, depth: ColorDepth): string | null {
  const asset = assets()[src]
  if (!asset) return null
  const width = Math.max(10, Math.min(columns - 2, mode === 'ascii' ? 100 : 80))
  if (mode === 'kitty') return `${kitty(read(asset.png), width)}\r\n`
  if (mode === 'iterm') return `${iterm(read(asset.png), width)}\r\n`
  if (mode === 'sixel') return `${read(asset.sixel).toString('latin1')}\r\n`
  const grid = { width: asset.grid.width, height: asset.grid.height, data: new Uint8Array(read(asset.grid.file)) }
  const lines = mode === 'blocks' ? halfBlocks(scale(grid, width, 2), depth) : ascii(scale(grid, width, 1))
  return lines.map((line) => `${line}\r\n`).join('')
}
