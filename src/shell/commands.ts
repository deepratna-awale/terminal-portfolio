import type { Project } from '../api'
import { fetchCowthink, fetchFortune } from '../api'
import { asciiLogo, mediaFiles, profile, sections } from '../content'
import { isThemeName, themeNames, themes, type ThemeName } from '../themes'

export type LineType = 'command' | 'output' | 'muted' | 'success' | 'error' | 'media' | 'ascii' | 'assistant'
export type Line = { id: number; type: LineType; text: string; media?: { src: string; alt: string; href?: string } }
export type NewLine = Omit<Line, 'id'>

export type ShellContext = {
  path: string
  previousPath: string
  history: string[]
  theme: ThemeName
  setPath: (path: string) => void
  print: (lines: NewLine[]) => void
  clear: () => void
  projects: () => Promise<Project[]>
  ask: (question: string) => Promise<void>
  ui: {
    setTheme: (theme: ThemeName) => void
    toggleMaximize: () => void
    toggleFullscreen: () => void
    exit: () => void
    matrix: () => void
    replayBoot: () => void
  }
}

type Command = { summary: string; group: 'Portfolio' | 'Navigation' | 'Terminal' | 'Fun'; usage?: string; hidden?: boolean; run: (args: string[], ctx: ShellContext) => void | Promise<void> }

export const directories = ['about', 'experience', 'projects', 'skills', 'publications', 'education', 'contact', 'media']
export const aliases: Record<string, string> = { ll: 'ls -l', la: 'ls -a', '..': 'cd ..', '~': 'cd ~', q: 'exit', h: 'help', cls: 'clear', papers: 'publications', research: 'publications' }

export const cmd = (label: string, command: string) => `[${label}](cmd:${encodeURIComponent(command)})`
const out = (text: string): NewLine => ({ type: 'output', text })
const muted = (text: string): NewLine => ({ type: 'muted', text })
const err = (text: string): NewLine => ({ type: 'error', text })
const fence = (text: string) => `\`\`\`text\n${text}\n\`\`\``
const clean = (target: string) => target.replace(/^~\/?/, '').replace(/^\//, '').replace(/\/$/, '')

export function openExternal(url: string) {
  if (url.startsWith('mailto:')) window.location.href = url
  else window.open(url, '_blank', 'noopener,noreferrer')
}

export function formatProject(project: Project, detailed = false): string {
  const meta = [project.language, project.stars ? `★ ${project.stars}` : null].filter(Boolean).join('  ')
  const links = [`[github](${project.url})`, project.homepage ? `[live](${project.homepage})` : null, cmd('screenshot', `view screenshots/${project.name}`)].filter(Boolean).join('  ')
  const bullets = project.bullets.length ? project.bullets : [project.description || 'No description yet.']
  return [`## ${project.name}${meta ? `  *${meta}*` : ''}`, ...bullets.map((bullet) => `- ${bullet}`), detailed ? `\nLast pushed ${new Date(project.pushedAt).toDateString()}` : '', `\n${links}`].filter(Boolean).join('\n')
}

async function showProjects(ctx: ShellContext, name?: string) {
  ctx.print([muted(name ? `fetching ${name} from github.com/deepratna-awale ...` : 'fetching public repositories from github.com/deepratna-awale ...')])
  try {
    const projects = await ctx.projects()
    if (name) {
      const project = projects.find((item) => item.name.toLowerCase() === name.toLowerCase().replace(/\.md$/, ''))
      ctx.print([project ? out(formatProject(project, true)) : err(`cat: projects/${name}: No such file or directory`)])
      return
    }
    ctx.print([...projects.map((project) => out(formatProject(project))), muted(`${projects.length} public repositories. Try \`cat projects/<name>\` or \`open <name>\`.`)])
  } catch (error) {
    ctx.print([err(`projects: ${error instanceof Error ? error.message : 'GitHub is unreachable right now'}`), muted(`Browse them directly at ${profile.github}`)])
  }
}

async function listDirectory(ctx: ShellContext, target: string, long: boolean) {
  const dir = clean(target)
  if (!dir) {
    ctx.print([out(directories.map((item) => cmd(`${item}/`, `cd ${item}`)).join('  ') + `  README.md  ${cmd('resume.pdf', 'resume')}` + (long ? '  .zshrc' : ''))])
    return
  }
  if (dir === 'projects') {
    try {
      const projects = await ctx.projects()
      ctx.print([out(projects.map((project) => cmd(project.name, `cat projects/${project.name}`)).join(long ? '\n' : '  '))])
    } catch { ctx.print([err('ls: projects: GitHub is unreachable right now')]) }
    return
  }
  if (dir === 'media') { ctx.print([out([...Object.keys(mediaFiles).map((file) => cmd(file, `view ${file}`)), cmd('screenshots/', 'ls media/screenshots')].join('  '))]); return }
  if (dir === 'media/screenshots' || dir === 'screenshots') {
    try {
      const projects = await ctx.projects()
      ctx.print([out(projects.map((project) => cmd(`${project.name}.png`, `view screenshots/${project.name}`)).join('  '))])
    } catch { ctx.print([err('ls: screenshots: GitHub is unreachable right now')]) }
    return
  }
  if (directories.includes(dir)) { ctx.print([out(`${dir}.md`)]); return }
  ctx.print([err(`ls: ${target}: No such file or directory`)])
}

async function viewMedia(ctx: ShellContext, target = 'architecture.svg') {
  const name = clean(target).replace(/^media\//, '')
  const file = mediaFiles[name] ?? mediaFiles[`${name}.svg`]
  if (file) { ctx.print([{ type: 'media', text: name, media: file }]); return }
  const repo = name.replace(/^screenshots\//, '').replace(/\.png$/, '')
  try {
    const project = (await ctx.projects()).find((item) => item.name.toLowerCase() === repo.toLowerCase())
    if (!project) { ctx.print([err(`view: ${target}: Media asset not found. Try \`ls media\`.`)]); return }
    ctx.print([{ type: 'media', text: `screenshots/${project.name}.png`, media: { src: `https://opengraph.githubassets.com/1/deepratna-awale/${project.name}`, alt: `GitHub preview card for ${project.name}`, href: project.url } }])
  } catch { ctx.print([err('view: GitHub is unreachable right now')]) }
}

function neofetch(ctx: ShellContext) {
  const uptime = Math.floor(performance.now() / 1000)
  const info = [
    `${profile.handle}@${profile.host}`,
    '-'.repeat(28),
    `OS:       DeepOS 26.10 (web)`,
    `Host:     AWS Lightsail nano, us-east-1`,
    `Kernel:   React 19 + Vite`,
    `Uptime:   ${Math.floor(uptime / 60)}m ${uptime % 60}s`,
    `Shell:    zsh (browser edition)`,
    `Theme:    ${themes[ctx.theme].label}`,
    `Role:     ${profile.title}`,
    `Focus:    Agentic AI for fraud & AML`,
    `Location: ${profile.location}`,
    `Cert:     AWS ML Engineer, Associate`,
  ]
  const art = asciiLogo.split('\n')
  ctx.print([{ type: 'ascii', text: art.join('\n') }, out(fence(info.join('\n')))])
}

export const commands: Record<string, Command> = {
  help: { group: 'Terminal', summary: 'list commands', run: (_args, ctx) => {
    const groups = ['Portfolio', 'Navigation', 'Terminal', 'Fun'] as const
    ctx.print([
      ...groups.flatMap((group) => [{ type: 'success' as const, text: group }, out(Object.entries(commands).filter(([, command]) => command.group === group && !command.hidden).map(([name, command]) => `  ${cmd(name.padEnd(13), name)}${command.summary}`).join('\n'))]),
      muted('Anything that is not a command goes to my AI assistant, e.g. "what are you working on at Nasdaq?"'),
      muted('zsh keys work: Tab, ^A ^E ^U ^K ^W ^Y ^L ^C ^R, ⌥B ⌥F, ↑↓, → accepts a suggestion, !! and !$. See `shortcuts`.'),
    ])
  } },
  about: { group: 'Portfolio', summary: 'who I am', run: (_args, ctx) => ctx.print([out(sections.about!.join('\n'))]) },
  experience: { group: 'Portfolio', summary: 'work history, including Nasdaq', run: (_args, ctx) => ctx.print([out(sections.experience!.join('\n'))]) },
  projects: { group: 'Portfolio', summary: 'live from my public GitHub', usage: 'projects [name]', run: (args, ctx) => showProjects(ctx, args[0]) },
  skills: { group: 'Portfolio', summary: 'tools and stacks', run: (_args, ctx) => ctx.print([out(sections.skills!.join('\n'))]) },
  publications: { group: 'Portfolio', summary: 'research papers', run: (_args, ctx) => ctx.print([out(sections.publications!.join('\n'))]) },
  education: { group: 'Portfolio', summary: 'degrees and certifications', run: (_args, ctx) => ctx.print([out(sections.education!.join('\n'))]) },
  contact: { group: 'Portfolio', summary: 'ways to reach me', run: (_args, ctx) => ctx.print([out(sections.contact!.join('\n'))]) },
  resume: { group: 'Portfolio', summary: 'open my resume (PDF)', run: (args, ctx) => {
    ctx.print([{ type: 'success', text: `[Resume-Awale-Deepratna.pdf](${profile.resume}) (opening in a new tab)` }])
    if (!args.includes('--no-open')) openExternal(profile.resume)
  } },
  email: { group: 'Portfolio', summary: 'open a new email to me', run: (_args, ctx) => { ctx.print([muted(`opening mailto:${profile.email} ...`)]); openExternal(`mailto:${profile.email}`) } },
  ask: { group: 'Portfolio', summary: 'ask the AI assistant anything about me', usage: 'ask <question>', run: (args, ctx) => args.length ? ctx.ask(args.join(' ')) : ctx.print([muted('usage: ask <question>   (or just type the question)')]) },
  ls: { group: 'Navigation', summary: 'list directory', usage: 'ls [dir]', run: (args, ctx) => {
    const flags = args.filter((arg) => arg.startsWith('-'))
    const target = args.find((arg) => !arg.startsWith('-')) ?? ctx.path
    return listDirectory(ctx, target === '~' ? '' : target, flags.some((flag) => flag.includes('l')))
  } },
  cd: { group: 'Navigation', summary: 'change directory', usage: 'cd <dir>', run: (args, ctx) => {
    const destination = args[0] ?? '~'
    if (destination === '-') { ctx.setPath(ctx.previousPath); ctx.print([muted(ctx.previousPath === '~' ? '~' : `~/${ctx.previousPath}`)]); return }
    if (destination === '..' || destination === '../') { ctx.setPath(ctx.path.includes('/') ? ctx.path.split('/')[0]! : '~'); return }
    if (destination === '~' || destination === '/') { ctx.setPath('~'); return }
    const dir = clean(destination)
    const resolved = ctx.path !== '~' && !destination.startsWith('~') && !destination.startsWith('/') && !directories.includes(dir) ? `${ctx.path}/${dir}` : dir
    if (directories.includes(resolved) || resolved === 'media/screenshots') { ctx.setPath(resolved); return }
    ctx.print([err(`cd: no such file or directory: ${destination}`)])
  } },
  pwd: { group: 'Navigation', summary: 'print working directory', run: (_args, ctx) => ctx.print([out(`/home/${profile.handle}${ctx.path === '~' ? '' : `/${ctx.path}`}`)]) },
  cat: { group: 'Navigation', summary: 'print a file', usage: 'cat <file>', run: (args, ctx) => {
    const target = args[0]
    if (!target) { ctx.print([err('usage: cat <file>')]); return }
    const full = clean(ctx.path !== '~' && !target.includes('/') && !directories.includes(clean(target).replace(/\.md$/, '')) ? `${ctx.path}/${target}` : target)
    const [dir, file] = full.split('/')
    const base = dir!.replace(/\.md$/, '')
    if (base === 'README' || base === 'README.md') return commands.about!.run([], ctx)
    if (base === 'resume.pdf' || base === 'resume') return commands.resume!.run([], ctx)
    if (base === '.zshrc') { ctx.print([out(fence(['export EDITOR=vim', 'setopt autocd histignoredups', ...Object.entries(aliases).map(([name, value]) => `alias ${name}='${value}'`), 'eval "$(curiosity init zsh)"'].join('\n')))]); return }
    if (base === 'projects' && file) return showProjects(ctx, file)
    if (base === 'media' && file) return viewMedia(ctx, file)
    if (commands[base] && directories.includes(base) && base !== 'projects' && base !== 'media') return commands[base]!.run([], ctx)
    if (base === 'projects') return showProjects(ctx)
    ctx.print([err(`cat: ${target}: No such file or directory`)])
  } },
  tree: { group: 'Navigation', summary: 'show the whole site map', run: async (_args, ctx) => {
    let projectNames: string[] = []
    try { projectNames = (await ctx.projects()).map((project) => project.name) } catch { projectNames = ['(GitHub unreachable)'] }
    const lines = ['~', ...directories.flatMap((dir, index) => {
      const last = index === directories.length - 1
      const children = dir === 'projects' ? projectNames : dir === 'media' ? [...Object.keys(mediaFiles), 'screenshots/'] : []
      return [`${last ? '└──' : '├──'} ${dir}/`, ...children.map((child, childIndex) => `${last ? '    ' : '│   '}${childIndex === children.length - 1 ? '└──' : '├──'} ${child}`)]
    }), '└── README.md']
    ctx.print([out(fence(lines.join('\n')))])
  } },
  view: { group: 'Navigation', summary: 'show an image, diagram or project screenshot', usage: 'view <file>', run: (args, ctx) => viewMedia(ctx, args[0]) },
  open: { group: 'Navigation', summary: 'open a project, github, linkedin or the source', usage: 'open <target>', run: async (args, ctx) => {
    const target = (args[0] ?? '').toLowerCase()
    const known: Record<string, string> = { github: profile.github, linkedin: profile.linkedin, source: profile.source, verafin: profile.product, email: `mailto:${profile.email}` }
    if (known[target]) { ctx.print([muted(`opening ${known[target]} ...`)]); openExternal(known[target]!); return }
    try {
      const project = (await ctx.projects()).find((item) => item.name.toLowerCase() === target)
      if (project) { ctx.print([muted(`opening ${project.url} ...`)]); openExternal(project.url); return }
    } catch { /* fall through to the error below */ }
    ctx.print([err(`open: ${args[0] ?? ''}: unknown target. Try github, linkedin, source, verafin or a project name.`)])
  } },
  clear: { group: 'Terminal', summary: 'clear the screen (^L)', run: (_args, ctx) => ctx.clear() },
  history: { group: 'Terminal', summary: 'command history (^R to search)', run: (_args, ctx) => ctx.print([out(ctx.history.map((item, index) => `${String(index + 1).padStart(5)}  ${item}`).join('\n') || 'No commands yet.')]) },
  theme: { group: 'Terminal', summary: `switch colours: ${themeNames.join(', ')}`, usage: 'theme [name]', run: (args, ctx) => {
    const name = args[0]
    if (!name) { ctx.print([out(themeNames.map((theme) => `${theme === ctx.theme ? '●' : '○'} ${cmd(theme, `theme ${theme}`)}  ${themes[theme].label}`).join('\n'))]); return }
    if (!isThemeName(name)) { ctx.print([err(`theme: unknown theme '${name}'`)]); return }
    ctx.ui.setTheme(name)
    ctx.print([{ type: 'success', text: `theme set to ${themes[name].label}` }])
  } },
  maximize: { group: 'Terminal', summary: 'toggle a maximized window', run: (_args, ctx) => ctx.ui.toggleMaximize() },
  fullscreen: { group: 'Terminal', summary: 'toggle browser full screen', run: (_args, ctx) => ctx.ui.toggleFullscreen() },
  shortcuts: { group: 'Terminal', summary: 'zsh keyboard shortcuts', run: (_args, ctx) => ctx.print([out(fence([
    'Tab          complete commands, dirs, projects (twice to list)',
    '→ / ^E        accept the grey autosuggestion',
    '↑ ↓ / ^P ^N  walk history          ^R   reverse-i-search',
    '^A ^E        start / end of line    ^B ^F  back / forward a char',
    '⌥B ⌥F        back / forward a word  ^T   transpose chars',
    '^U ^K        kill to start / end    ^W ⌥⌫  kill previous word',
    '⌥D           kill next word         ^Y   yank killed text',
    '^L           clear screen           ^C   cancel line',
    '^D           exit on an empty line  !! !$ !n !-n !prefix  history expansion',
  ].join('\n')))]) },
  whoami: { group: 'Terminal', summary: 'print effective user', hidden: true, run: (_args, ctx) => ctx.print([out('guest  (but you can ask about deepratna)')]) },
  date: { group: 'Terminal', summary: 'print the date', hidden: true, run: (_args, ctx) => ctx.print([out(new Date().toString())]) },
  echo: { group: 'Terminal', summary: 'print text', hidden: true, run: (args, ctx) => ctx.print([out(args.join(' ').replace(/^['"]|['"]$/g, '').replace(/\$USER/g, 'guest').replace(/\$SHELL/g, '/bin/zsh').replace(/\$HOME/g, `/home/${profile.handle}`))]) },
  uname: { group: 'Terminal', summary: 'system info', hidden: true, run: (args, ctx) => ctx.print([out(args.includes('-a') ? 'DeepOS deepratna-awale.dev 26.10 React-19 x86_64 Lightsail/nano zsh' : 'DeepOS')]) },
  alias: { group: 'Terminal', summary: 'list aliases', hidden: true, run: (_args, ctx) => ctx.print([out(Object.entries(aliases).map(([name, value]) => `${name}='${value}'`).join('\n'))]) },
  man: { group: 'Terminal', summary: 'manual for a command', usage: 'man <command>', hidden: true, run: (args, ctx) => {
    const command = commands[args[0] ?? '']
    ctx.print([command ? out(`**${args[0]}** - ${command.summary}\n\nusage: ${command.usage ?? args[0]}`) : err(`No manual entry for ${args[0] ?? ''}`)])
  } },
  reboot: { group: 'Terminal', summary: 'replay the SSH login', run: (_args, ctx) => ctx.ui.replayBoot() },
  exit: { group: 'Terminal', summary: 'close the SSH session', run: (_args, ctx) => ctx.ui.exit() },
  neofetch: { group: 'Fun', summary: 'system info, with style', run: (_args, ctx) => neofetch(ctx) },
  fortune: { group: 'Fun', summary: 'a real /usr/games/fortune', run: async (_args, ctx) => {
    try { ctx.print([out(fence(await fetchFortune()))]) } catch (error) { ctx.print([err(error instanceof Error ? error.message : 'fortune is unavailable')]) }
  } },
  cowthink: { group: 'Fun', summary: 'Tux thinks out loud (try fortune | cowthink)', usage: 'cowthink <text>', run: async (args, ctx) => {
    try { ctx.print([out(fence(await fetchCowthink(args.join(' ').replace(/^['"]|['"]$/g, '') || 'moo')))]) } catch (error) { ctx.print([err(error instanceof Error ? error.message : 'cowthink is unavailable')]) }
  } },
  matrix: { group: 'Fun', summary: 'follow the white rabbit', run: (_args, ctx) => { ctx.print([{ type: 'success', text: 'Wake up, guest... (press any key to exit)' }]); ctx.ui.matrix() } },
  sudo: { group: 'Fun', summary: 'try it', hidden: true, run: (args, ctx) => ctx.print([args.join(' ').includes('rm -rf') ? err('Nice try. This portfolio is immutable infrastructure: it would just redeploy itself.') : err('guest is not in the sudoers file. This incident will be reported to deepratna.')]) },
  rm: { group: 'Fun', summary: 'remove files', hidden: true, run: (_args, ctx) => ctx.print([err('rm: permission denied: read-only portfolio filesystem')]) },
  vim: { group: 'Fun', summary: 'editor', hidden: true, run: (_args, ctx) => ctx.print([muted('Opening vim... just kidding. Nobody here knows how to exit it either. Try `:q`.')]) },
  ':q': { group: 'Fun', summary: 'quit vim', hidden: true, run: (_args, ctx) => ctx.print([{ type: 'success', text: 'You escaped vim. Achievement unlocked.' }]) },
  ssh: { group: 'Fun', summary: 'connect to a host', hidden: true, run: (_args, ctx) => ctx.print([muted('You are already connected to deepratna-awale.dev. Run `reboot` to replay the login.')]) },
  hire: { group: 'Fun', summary: 'the best command', hidden: true, run: (_args, ctx) => ctx.print([{ type: 'success', text: `Great choice. ${cmd('email', 'email')} me or reach out on [LinkedIn](${profile.linkedin}).` }]) },
}

export const commandNames = [...Object.keys(commands), ...Object.keys(aliases)].sort()

export function tokenize(input: string): string[] {
  return input.match(/(?:[^\s"']|"[^"]*"|'[^']*')+/g)?.map((token) => token.replace(/^(["'])(.*)\1$/, '$2')) ?? []
}

export function resolveAlias(input: string): string {
  const [first, ...rest] = input.trim().split(/\s+/)
  const alias = aliases[first ?? '']
  return alias ? [alias, ...rest].join(' ') : input.trim()
}
