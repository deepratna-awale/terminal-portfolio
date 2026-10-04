import { mediaFiles } from '../content'
import { commandNames, directories } from './commands'

export type Completion = { prefix: string; fragment: string; candidates: string[] }

const pathCommands = new Set(['cd', 'cat', 'ls', 'll', 'la', 'view', 'open', 'projects', 'theme', 'man', 'tree'])

function argumentOptions(command: string, path: string, projectNames: string[], themeNames: string[]): string[] {
  if (command === 'theme') return themeNames
  if (command === 'man') return commandNames
  if (command === 'open') return ['github', 'linkedin', 'source', 'verafin', 'email', ...projectNames]
  if (command === 'projects') return projectNames
  const here = path === '~' ? '' : path
  if (here === 'projects') return projectNames
  if (here === 'media') return [...Object.keys(mediaFiles), 'screenshots/']
  const dirs = directories.map((dir) => `${dir}/`)
  if (command === 'cd') return dirs
  if (command === 'view') return [...Object.keys(mediaFiles), 'screenshots/', ...dirs]
  return [...dirs, 'README.md', '.zshrc']
}

function nestedOptions(directory: string, projectNames: string[]): string[] {
  if (directory === 'projects') return projectNames
  if (directory === 'media') return [...Object.keys(mediaFiles), 'screenshots/']
  if (directory === 'screenshots' || directory === 'media/screenshots') return projectNames.map((name) => `${name}.png`)
  return []
}

export function complete(input: string, path: string, projectNames: string[], themeNames: string[]): Completion {
  const endsWithSpace = /\s$/.test(input)
  const tokens = input.trimStart().split(/\s+/).filter(Boolean)
  if (tokens.length <= 1 && !endsWithSpace) {
    const fragment = tokens[0] ?? ''
    return { prefix: input.slice(0, input.length - fragment.length), fragment, candidates: fragment ? commandNames.filter((name) => name.startsWith(fragment)) : [] }
  }
  const command = tokens[0]!
  if (!pathCommands.has(command)) return { prefix: input, fragment: '', candidates: [] }
  const partial = endsWithSpace ? '' : tokens.at(-1)!
  const slash = partial.lastIndexOf('/')
  const directory = slash === -1 ? '' : partial.slice(0, slash).replace(/^~\//, '')
  const fragment = slash === -1 ? partial : partial.slice(slash + 1)
  const options = directory ? nestedOptions(directory, projectNames) : argumentOptions(command, path, projectNames, themeNames)
  const lower = fragment.toLowerCase()
  return { prefix: input.slice(0, input.length - fragment.length), fragment, candidates: options.filter((option) => option.toLowerCase().startsWith(lower)) }
}

export function commonPrefix(values: string[]): string {
  if (!values.length) return ''
  let prefix = values[0]!
  for (const value of values.slice(1)) {
    while (!value.toLowerCase().startsWith(prefix.toLowerCase())) prefix = prefix.slice(0, -1)
  }
  return prefix
}

// zsh-autosuggestions style: newest matching history entry, else a unique completion.
export function suggestion(input: string, history: string[], path: string, projectNames: string[], themeNames: string[]): string {
  if (!input.trim()) return ''
  const fromHistory = [...history].reverse().find((item) => item.startsWith(input) && item !== input)
  if (fromHistory) return fromHistory.slice(input.length)
  const { fragment, candidates } = complete(input, path, projectNames, themeNames)
  if (candidates.length === 1 && candidates[0]!.startsWith(fragment) && candidates[0] !== fragment) return candidates[0]!.slice(fragment.length)
  return ''
}
