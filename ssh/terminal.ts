// What the visitor's terminal can do, and the keys it sends.
import type { ColorDepth } from './ansi'

export type ImageMode = 'kitty' | 'iterm' | 'sixel' | 'blocks' | 'ascii'
export type Graphics = { images: ImageMode; color: ColorDepth; hyperlinks: boolean }
export const imageModes: ImageMode[] = ['kitty', 'iterm', 'sixel', 'blocks', 'ascii']

// A first guess from TERM and the variables OpenSSH forwards (macOS sends LC_*,
// so iTerm2's LC_TERMINAL arrives; TERM_PROGRAM and COLORTERM only with SendEnv).
export function detect(term: string, env: Record<string, string>): Graphics {
  const name = term.toLowerCase()
  const program = `${env.TERM_PROGRAM ?? ''} ${env.LC_TERMINAL ?? ''}`.toLowerCase()
  const color: ColorDepth = /^(linux|vt\d+|ansi|dumb)$/.test(name) || (name === 'xterm' && !env.COLORTERM) ? '16' : '256color truecolor 24bit direct kitty ghostty wezterm alacritty foot'.split(' ').some((hint) => name.includes(hint)) || /truecolor|24bit/.test(env.COLORTERM ?? '') ? 'truecolor' : '256'
  let images: ImageMode = color === '16' ? 'ascii' : 'blocks'
  if (/iterm|wezterm/.test(program)) images = 'iterm'
  else if (name === 'xterm-kitty' || name === 'xterm-ghostty' || /ghostty|kitty/.test(program)) images = 'kitty'
  return { images, color, hyperlinks: name !== 'linux' && name !== 'dumb' }
}

// Asked once at login: kitty graphics support, the terminal's name (XTVERSION)
// and its device attributes. Every terminal answers the last one, which ends the probe.
export const probeQuery = '\x1b_Gi=31,s=1,v=1,a=q,t=d,f=24;AAAA\x1b\\\x1b[>0q\x1b[c'
export const probeDone = (input: string) => /\x1b\[\?[\d;]*c/.test(input)
const probeReplies = /\x1b_G[^\x1b]*\x1b\\|\x1bP>\|[^\x1b]*\x1b\\|\x1b\[\?[\d;]*c/g
export const stripProbeReplies = (input: string) => input.replace(probeReplies, '')

export function applyProbe(graphics: Graphics, replies: string): Graphics {
  const version = /\x1bP>\|([^\x1b]*)\x1b\\/.exec(replies)?.[1]?.toLowerCase() ?? ''
  const attributes = /\x1b\[\?([\d;]*)c/.exec(replies)?.[1]?.split(';') ?? []
  // tmux and screen swallow image escapes unless configured to pass them through.
  if (/tmux|screen/.test(version)) return { ...graphics, images: graphics.color === '16' ? 'ascii' : 'blocks' }
  if (/iterm|wezterm/.test(version)) return { ...graphics, images: 'iterm', color: 'truecolor' }
  if (/\x1b_Gi=31;OK/.test(replies)) return { ...graphics, images: 'kitty', color: 'truecolor' }
  if (attributes.includes('4')) return { ...graphics, images: 'sixel' }
  if (/kitty|ghostty|foot|alacritty|contour/.test(version)) return { ...graphics, color: 'truecolor' }
  return graphics
}

export type Key = { name: string; text?: string; ctrl?: boolean; alt?: boolean; shift?: boolean }

const csiNames: Record<string, string> = { A: 'up', B: 'down', C: 'right', D: 'left', H: 'home', F: 'end', Z: 'backtab' }
const tildeNames: Record<string, string> = { 1: 'home', 7: 'home', 4: 'end', 8: 'end', 3: 'delete', 2: 'insert', 5: 'pageup', 6: 'pagedown' }
const controlNames: Record<number, string> = { 9: 'tab', 13: 'enter', 10: 'enter', 127: 'backspace', 8: 'backspace', 27: 'escape', 0: 'space' }

// Splits raw input into keys. Bracketed paste arrives as one 'paste' key.
export function parseKeys(input: string): Key[] {
  const keys: Key[] = []
  let index = 0
  while (index < input.length) {
    const rest = input.slice(index)
    if (rest.startsWith('\x1b[200~')) {
      const end = rest.indexOf('\x1b[201~')
      const text = end === -1 ? rest.slice(6) : rest.slice(6, end)
      keys.push({ name: 'paste', text })
      index += end === -1 ? rest.length : end + 6
      continue
    }
    // Some terminals send Option+arrow as ESC followed by the arrow's sequence.
    let match = /^(\x1b?)\x1b\[([\d;]*)([A-Za-z~])/.exec(rest)
    if (match) {
      const [whole, escaped, params = '', final = ''] = match
      const parts = params.split(';')
      const modifier = Number(parts[1] ?? 1) - 1
      const name = final === '~' ? tildeNames[parts[0] ?? ''] : csiNames[final]
      keys.push({ name: name ?? 'unknown', shift: Boolean(modifier & 1), alt: Boolean(escaped) || Boolean(modifier & 2), ctrl: Boolean(modifier & 4) })
      index += whole.length
      continue
    }
    match = /^\x1bO([A-Za-z])/.exec(rest)
    if (match) { keys.push({ name: csiNames[match[1]!] ?? 'unknown' }); index += 3; continue }
    const code = rest.charCodeAt(0)
    if (code === 27 && rest.length > 1) {
      const next = rest.codePointAt(1)!
      const char = String.fromCodePoint(next)
      if (next === 127 || next === 8) keys.push({ name: 'backspace', alt: true })
      else if (next < 32) keys.push({ name: controlNames[next] ?? String.fromCharCode(next + 96), ctrl: !controlNames[next], alt: true })
      else keys.push({ name: char.toLowerCase(), text: char, alt: true })
      index += 1 + char.length
      continue
    }
    if (controlNames[code]) { keys.push({ name: controlNames[code]! }); index += rest.startsWith('\r\n') ? 2 : 1; continue }
    if (code < 32) { keys.push({ name: String.fromCharCode(code + 96), ctrl: true }); index++; continue }
    const char = String.fromCodePoint(rest.codePointAt(0)!)
    keys.push({ name: char, text: char })
    index += char.length
  }
  return keys
}
