import { commands, resolveAlias, tokenize } from './commands'

// Commands that act outside the transcript (new tabs, mail client, toggles, full-screen effects).
// They never run from a URL, so reloading the page or reopening the terminal cannot repeat them.
export const sideEffects = new Set(['open', 'resume', 'email', 'matrix', 'crt', 'maximize', 'fullscreen'])
// Commands that should not become the shareable URL.
export const unshareable = new Set(['clear', 'exit', 'reboot', 'history', 'share', 'sudo', 'rm', 'hack', 'snake', '2048', 'vim', 'vi', 'nvim', 'guestbook', 'gui', ...sideEffects])
const hasSideEffects = (input: string) => input.split(/\s*(?:&&|;|\|)\s*/).some((part) => sideEffects.has(tokenize(resolveAlias(part))[0] ?? ''))
export const pipeSplit = (input: string) => input.match(/(?:[^|"']|"[^"]*"|'[^']*')+/g)?.map((part) => part.trim()) ?? []

// /?cmd=projects, or a path such as /projects or /projects/<name>.
export function initialCommand(location: Pick<Location, 'search' | 'pathname'>): string | null {
  const cmd = new URLSearchParams(location.search).get('cmd')
  if (cmd) return hasSideEffects(cmd) ? null : cmd.slice(0, 200)
  const [first, second] = decodeURIComponent(location.pathname).split('/').filter(Boolean)
  if (!first) return null
  if (first === 'projects' && second) return `cat projects/${second}`
  return commands[first] && !commands[first]!.hidden && !unshareable.has(first) ? first : null
}
