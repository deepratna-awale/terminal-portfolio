import { commands } from './commands'

// Commands that should not become the shareable URL.
export const unshareable = new Set(['clear', 'exit', 'reboot', 'history', 'share', 'sudo', 'rm', 'snake', '2048', 'vim', 'vi', 'nvim', 'guestbook', 'gui'])
export const pipeSplit = (input: string) => input.match(/(?:[^|"']|"[^"]*"|'[^']*')+/g)?.map((part) => part.trim()) ?? []

// /?cmd=projects, or a path such as /projects or /projects/<name>.
export function initialCommand(location: Pick<Location, 'search' | 'pathname'>): string | null {
  const cmd = new URLSearchParams(location.search).get('cmd')
  if (cmd) return cmd.slice(0, 200)
  const [first, second] = decodeURIComponent(location.pathname).split('/').filter(Boolean)
  if (!first) return null
  if (first === 'projects' && second) return `cat projects/${second}`
  return commands[first] && !commands[first]!.hidden && !unshareable.has(first) ? first : null
}
