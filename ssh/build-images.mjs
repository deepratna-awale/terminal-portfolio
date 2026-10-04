// Pre-renders every image `view` can show into the forms the SSH server sends:
// a PNG for kitty and iTerm2, a sixel string, and a small RGB grid that is
// scaled to the visitor's width for half-block and ASCII output.
// Run after the SSH build: node ssh/build-images.mjs
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { parseAboutMarkdown } from '../shared/about.js'

const root = fileURLToPath(new URL('..', import.meta.url))
const out = join(root, 'ssh', 'dist', 'images')
const background = '#14151a'
const pngWidth = 960
const sixelWidth = 560
const gridWidth = 160

// The media files ABOUT.md lists, plus every project share image.
const { meta } = parseAboutMarkdown(readFileSync(join(root, 'ABOUT.md'), 'utf8'))
const sources = [
  ...Object.keys(meta.media ?? {}).map((file) => `/media/${file}`),
  ...readdirSync(join(root, 'public/media/projects')).filter((file) => /\.(svg|png|jpe?g|webp)$/i.test(file)).map((file) => `/media/projects/${file}`),
]

// Six pixel rows per band; each palette colour gets one run-length encoded row per band.
export function sixel(data, width, height, channels) {
  const colors = new Map()
  const indexes = new Uint16Array(width * height)
  for (let pixel = 0; pixel < width * height; pixel++) {
    const key = (data[pixel * channels] << 16) | (data[pixel * channels + 1] << 8) | data[pixel * channels + 2]
    if (!colors.has(key)) colors.set(key, colors.size)
    indexes[pixel] = colors.get(key)
  }
  if (colors.size > 256) throw new Error(`sixel: ${colors.size} colours, quantize first`)
  let result = `\x1bP0;1;0q"1;1;${width};${height}`
  for (const [key, index] of colors) result += `#${index};2;${Math.round(((key >> 16) & 255) / 2.55)};${Math.round(((key >> 8) & 255) / 2.55)};${Math.round((key & 255) / 2.55)}`
  for (let top = 0; top < height; top += 6) {
    const used = new Set()
    for (let y = top; y < Math.min(top + 6, height); y++) for (let x = 0; x < width; x++) used.add(indexes[y * width + x])
    const rows = []
    for (const color of used) {
      let row = ''
      let run = ''
      let count = 0
      const flush = () => { if (count) row += count > 3 ? `!${count}${run}` : run.repeat(count); count = 0 }
      for (let x = 0; x < width; x++) {
        let bits = 0
        for (let bit = 0; bit < 6 && top + bit < height; bit++) if (indexes[(top + bit) * width + x] === color) bits |= 1 << bit
        const char = String.fromCharCode(63 + bits)
        if (char !== run) { flush(); run = char }
        count++
      }
      if (run !== '?') flush()
      rows.push(`#${color}${row}`)
    }
    result += rows.join('$') + '-'
  }
  return `${result}\x1b\\`
}

const slug = (path) => path.replace(/^\/media\//, '').replace(/[^\w.-]+/g, '_').replace(/\.\w+$/, '')

async function prerender(path) {
  const file = join(root, 'public', path)
  const base = () => sharp(file, { density: 144 }).flatten({ background })
  const name = slug(path)
  const png = await base().resize({ width: pngWidth, withoutEnlargement: true }).png({ palette: true, compressionLevel: 9 }).toBuffer({ resolveWithObject: true })
  writeFileSync(join(out, `${name}.png`), png.data)
  const quantized = await sharp(await base().resize({ width: sixelWidth }).png({ palette: true, colors: 128, dither: 0.8 }).toBuffer()).raw().toBuffer({ resolveWithObject: true })
  writeFileSync(join(out, `${name}.six`), sixel(quantized.data, quantized.info.width, quantized.info.height, quantized.info.channels))
  const grid = await base().resize({ width: gridWidth }).removeAlpha().raw().toBuffer({ resolveWithObject: true })
  writeFileSync(join(out, `${name}.rgb`), grid.data)
  return [path, { png: `${name}.png`, width: png.info.width, height: png.info.height, sixel: `${name}.six`, grid: { file: `${name}.rgb`, width: grid.info.width, height: grid.info.height } }]
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  mkdirSync(out, { recursive: true })
  const manifest = Object.fromEntries(await Promise.all(sources.map(prerender)))
  writeFileSync(join(out, 'manifest.json'), JSON.stringify(manifest, null, 2))
  console.log(`pre-rendered ${sources.length} images into ssh/dist/images`)
}
