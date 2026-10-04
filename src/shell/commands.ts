import type { Project } from '../api'
import { fetchContributions, fetchCowthink, fetchFortune, fetchGuestbook, signGuestbook } from '../api'
import { exampleQuestion, extraLinks, linkLabel, liveSections, mediaFiles, neofetchRows, nowItems, os, profile, sectionList, sections } from '../content'
import { isThemeName, themeNames, themes, type ThemeName } from '../themes'
import { renderHeatmap } from './heatmap'
import { filters, grepLines, toPlainText } from './pipes'
import { closest } from './typo'

export type LineType = 'command' | 'output' | 'muted' | 'success' | 'error' | 'media' | 'ascii' | 'assistant' | 'plain' | 'neofetch' | 'section' | 'projects'
export type Line = { id: number; type: LineType; text: string; media?: { src: string; alt: string; href?: string }; info?: string[]; section?: string; projects?: Project[]; detailed?: boolean }
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
  prompt: (label: string) => Promise<string | null>
  ui: {
    setTheme: (theme: ThemeName) => void
    toggleMaximize: () => void
    toggleFullscreen: () => void
    exit: () => void
    matrix: () => void
    replayBoot: () => void
    setCrt: (on: boolean) => void
    crt: boolean
    game: (name: 'snake' | '2048') => void
    vim: (file: string, text: string) => void
    meltdown: () => void
    openBrowser: (url?: string) => void
  }
}

type Command = { summary: string; group: 'Portfolio' | 'Navigation' | 'Terminal' | 'Fun'; usage?: string; hidden?: boolean; run: (args: string[], ctx: ShellContext) => void | Promise<void> }

// Every ABOUT.md section is a directory holding <name>.md, except the interactive now and guestbook.
export const directories = [...sectionList.map((item) => item.id).filter((id) => id !== 'now' && id !== 'guestbook'), 'media']
export const aliases: Record<string, string> = { ll: 'ls -l', la: 'ls -a', '..': 'cd ..', '~': 'cd ~', q: 'exit', h: 'help', cls: 'clear', papers: 'publications', research: 'publications', graph: 'contributions', gb: 'guestbook', cowsay: 'cowthink', html: 'gui' }

export const cmd = (label: string, command: string) => `[${label}](cmd:${encodeURIComponent(command)})`
const out = (text: string): NewLine => ({ type: 'output', text })
const muted = (text: string): NewLine => ({ type: 'muted', text })
const err = (text: string): NewLine => ({ type: 'error', text })
const section = (name: string): NewLine => ({ type: 'section', section: name, text: sections[name]!.join('\n') })
const fence = (text: string) => `\`\`\`text\n${text}\n\`\`\``
const clean = (target: string) => target.replace(/^~\/?/, '').replace(/^\//, '').replace(/\/$/, '')
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
const didYouMean = (suggestion: string | undefined, command: string) => (suggestion ? [muted(`did you mean ${cmd(`\`${command}\``, command)}?`)] : [])
export const siteUrl = (command: string) => `${profile.website}/?cmd=${encodeURIComponent(command)}`

// The virtual filesystem: every top-level section is a directory holding <name>.md.
export const fileNames = [...directories.filter((dir) => sections[dir] && !liveSections.has(dir)).map((dir) => `${dir}.md`), 'README.md', 'resume.md', '.zshrc']

const zshrc = () => ['export EDITOR=vim', 'setopt autocd histignoredups', ...Object.entries(aliases).map(([name, value]) => `alias ${name}='${value}'`), 'eval "$(curiosity init zsh)"'].join('\n')

export function resumeText(): string {
  return [`# ${profile.name}`, `${profile.title} | ${profile.location}`, `${profile.email} | ${profile.linkedin} | ${profile.github}`, '', ...sectionList.filter((item) => !liveSections.has(item.id) && item.id !== 'contact').flatMap(({ id: name, title }) => [`## ${title}`, ...sections[name]!.filter((line) => !line.includes('](cmd:') && !line.startsWith('# ')).map((line) => (line.startsWith('## ') ? `### ${toPlainText(line)}` : toPlainText(line))), ''])].join('\n').replace(/\n{3,}/g, '\n\n')
}

// Resolves a path to the plain text of a static file, or undefined.
export function readFile(target: string, path = '~'): { name: string; text: string } | undefined {
  const raw = clean(target)
  const full = path !== '~' && !raw.includes('/') && !directories.includes(raw.replace(/\.md$/, '')) && !fileNames.includes(raw) ? `${path}/${raw}` : raw
  const parts = full.split('/')
  const base = (parts.at(-1) ?? '').replace(/\.(md|pdf|txt)$/, '')
  if (parts.length > 2 || (parts.length === 2 && parts[0] !== base)) return undefined
  if (base === 'README' || base === 'readme') return { name: 'README.md', text: sections.about!.map(toPlainText).join('\n') }
  if (base === 'resume') return { name: 'resume.md', text: resumeText() }
  if (base === '.zshrc') return { name: '.zshrc', text: zshrc() }
  if (sections[base] && !liveSections.has(base)) return { name: `${base}.md`, text: sections[base]!.map(toPlainText).join('\n') }
  return undefined
}

function allFiles(): Array<{ name: string; text: string }> {
  return fileNames.filter((name) => name !== '.zshrc' && name !== 'resume.md').map((name) => readFile(name)!).filter(Boolean)
}

// rm -rf /, rm -fr /*, rm -rf --no-preserve-root / and friends.
export const isRootWipe = (args: string[]) => args.some((arg) => /^-[a-zA-Z]*r[a-zA-Z]*$/.test(arg) || arg === '--recursive') && args.some((arg) => arg === '/' || arg === '/*' || arg === '~' || arg === '~/' || arg === '*')

const train = [
  '      ====        ________                ___________',
  '  _D _|  |_______/        \\__I_I_____===__|_________|',
  '   |(_)---  |   H\\________/ |   |        =|___ ___|',
  '   /     |  |   H  |  |     |   |         ||_| |_||',
  '  |      |  |   H  |__--------------------| [___] |',
  '  | ________|___H__/__|_____/[][]~\\_______|       |',
  '  |/ |   |-----------I_____I [][] []  D   |=======|__',
  '__/ =| o |=-~~\\  /~~\\  /~~\\  /~~\\ ____Y___________|__',
  ' |/-=|___|=    ||    ||    ||    |_____/~\\___/',
  '  \\_/      \\O=====O=====O=====O_/      \\_/',
].join('\n')

const escapeMd = (text: string) => text.replace(/([\\`*_[\]<>#|~])/g, '\\$1')

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
  ctx.print([muted(name ? `fetching ${name} from ${linkLabel(profile.github)} ...` : `fetching public repositories from ${linkLabel(profile.github)} ...`)])
  try {
    const projects = await ctx.projects()
    if (name) {
      const project = projects.find((item) => item.name.toLowerCase() === name.toLowerCase().replace(/\.md$/, ''))
      if (project) { ctx.print([{ type: 'projects', text: formatProject(project, true), projects: [project], detailed: true }]); return }
      const guess = closest(name, projects.map((item) => item.name))
      ctx.print([err(`cat: projects/${name}: No such file or directory`), ...didYouMean(guess, `cat projects/${guess}`)])
      return
    }
    ctx.print([{ type: 'projects', text: projects.map((project) => formatProject(project)).join('\n\n'), projects }, muted(`${projects.length} public repositories. Try \`cat projects/<name>\` or \`open <name>\`.`)])
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
  if (directories.includes(dir)) { ctx.print([out(cmd(`${dir}.md`, `cat ${dir}`))]); return }
  const guess = closest(dir, directories)
  ctx.print([err(`ls: ${target}: No such file or directory`), ...didYouMean(guess, `ls ${guess}`)])
}

async function viewMedia(ctx: ShellContext, target = 'architecture.svg') {
  const name = clean(target).replace(/^media\//, '')
  const file = mediaFiles[name] ?? mediaFiles[`${name}.svg`]
  if (file) { ctx.print([{ type: 'media', text: name, media: file }]); return }
  const repo = name.replace(/^screenshots\//, '').replace(/\.png$/, '')
  try {
    const project = (await ctx.projects()).find((item) => item.name.toLowerCase() === repo.toLowerCase())
    if (!project) { ctx.print([err(`view: ${target}: Media asset not found. Try \`ls media\`.`)]); return }
    if (!project.image) { ctx.print([err(`view: ${target}: No preview image for ${project.name}.`)]); return }
    ctx.print([{ type: 'media', text: `screenshots/${project.name}.png`, media: { src: project.image, alt: `Preview card for ${project.name}`, href: project.url } }])
  } catch { ctx.print([err('view: GitHub is unreachable right now')]) }
}

export function neofetchInfo(theme: ThemeName): string[] {
  const uptime = Math.floor(performance.now() / 1000)
  return [
    `OS:       ${os.name} ${os.version}`,
    `Host:     AWS Lightsail nano, us-east-1`,
    `Kernel:   React 19 + Vite`,
    `Uptime:   ${Math.floor(uptime / 60)}m ${uptime % 60}s`,
    `Shell:    zsh (browser edition)`,
    `Theme:    ${themes[theme].label}`,
    ...Object.entries(neofetchRows).map(([label, value]) => `${`${label}:`.padEnd(10)}${value}`),
  ]
}

const neofetch = (ctx: ShellContext) => ctx.print([{ type: 'neofetch', text: `${profile.handle}@${profile.host}`, info: neofetchInfo(ctx.theme) }])

const relative = (iso: string) => {
  const days = Math.floor((Date.now() - Date.parse(iso)) / 86_400_000)
  return days <= 0 ? 'today' : days === 1 ? 'yesterday' : days < 30 ? `${days} days ago` : days < 365 ? `${Math.floor(days / 30)} months ago` : `${Math.floor(days / 365)} years ago`
}

async function contributions(ctx: ShellContext, quiet = false) {
  if (!quiet) ctx.print([muted(`fetching ${linkLabel(profile.github)} contributions ...`)])
  try {
    const data = await fetchContributions()
    ctx.print([{ type: 'ascii', text: renderHeatmap(data.days) }, muted(`${data.total.toLocaleString()} contributions in the last year. Less · ░ ▒ ▓ █ More`)])
  } catch (error) {
    ctx.print([err(`contributions: ${error instanceof Error ? error.message : 'GitHub is unreachable right now'}`)])
  }
}

async function now(ctx: ShellContext) {
  ctx.print([{ type: 'success', text: `What I'm doing now (updated ${nowItems.updated})` }, out(nowItems.items.map((item) => `- ${item}`).join('\n'))])
  try {
    const recent = [...await ctx.projects()].sort((a, b) => Date.parse(b.pushedAt) - Date.parse(a.pushedAt)).slice(0, 3)
    if (recent.length) ctx.print([out(`**Recently pushed**\n${recent.map((project) => `- ${cmd(project.name, `cat projects/${project.name}`)}  *${relative(project.pushedAt)}*`).join('\n')}`)])
  } catch { /* projects are a bonus here */ }
  await contributions(ctx, true)
}

async function meltdown(ctx: ShellContext) {
  const victims = ['/usr/bin/zsh', '/etc/passwd', `/home/${profile.handle}/projects`, `/home/${profile.handle}/resume.pdf`, '/var/www/portfolio/index.html', '/opt/bedrock/claude', '/lib/react.so.19', `/boot/vmlinuz-${os.name.toLowerCase()}`, '/dev/coffee']
  const fast = reducedMotion()
  for (const victim of victims) { ctx.print([muted(`removed '${victim}'`)]); if (!fast) await sleep(110) }
  ctx.ui.meltdown()
  ctx.print([err('rm: cannot remove \'/proc/self\': the portfolio is eating itself')])
  if (!fast) await sleep(1600)
  ctx.clear()
  ctx.print([{ type: 'ascii', text: ['Kernel panic - not syncing: Attempted to kill init! exitcode=0x0000dead', '', '---[ end Kernel panic - not syncing ]---', '', 'Relax: this site is immutable infrastructure. Redeploying from the last image ...'].join('\n') }])
  if (!fast) await sleep(2400)
  ctx.ui.replayBoot()
}

// `guestbook sign [--name <name>] [message]`; anything missing is asked for.
export function parseSign(args: string[]): { name: string; message: string } {
  let name = ''
  const words: string[] = []
  for (let index = 0; index < args.length; index++) {
    const arg = args[index]!
    if (arg === '-n' || arg === '--name' || arg === '--as') name = args[++index] ?? ''
    else if (/^--(name|as)=/.test(arg)) name = arg.replace(/^--(name|as)=/, '')
    else words.push(arg)
  }
  return { name: name.trim(), message: words.join(' ').trim() }
}

async function guestbook(args: string[], ctx: ShellContext) {
  if (args[0] === 'sign') {
    let { name, message } = parseSign(args.slice(1))
    if (!message) {
      ctx.print([muted('Signing the guestbook. Plain text, up to 280 characters, shown publicly. ^C to cancel.')])
      if (!name) {
        const answer = await ctx.prompt('your name (enter for guest): ')
        if (answer === null) return
        name = answer.trim()
      }
      const answer = await ctx.prompt('message: ')
      if (answer === null || !answer.trim()) { ctx.print([muted('guestbook: nothing signed')]); return }
      message = answer.trim()
    }
    ctx.print([muted('checking your note ...')])
    try {
      const entry = await signGuestbook(name || 'guest', message)
      ctx.print([{ type: 'success', text: `Signed. Thanks, ${entry.name}!` }, { type: 'plain', text: `${entry.name} · just now\n  ${entry.message}` }])
    } catch (error) { ctx.print([err(`guestbook: ${error instanceof Error ? error.message : 'unavailable right now'}`)]) }
    return
  }
  try {
    const entries = await fetchGuestbook()
    if (!entries.length) ctx.print([muted('The guestbook is empty. Be the first: `guestbook sign`')])
    else ctx.print([{ type: 'plain', text: entries.slice(0, Number(args[0]) || 12).map((entry) => `${entry.name} · ${relative(entry.at)}\n  ${entry.message}`).join('\n\n') }])
    ctx.print([muted(`Leave a note: ${cmd('guestbook sign', 'guestbook sign')} (asks for your name), or \`guestbook sign --name Ada "love the terminal!"\``)])
  } catch (error) { ctx.print([err(`guestbook: ${error instanceof Error ? error.message : 'unavailable right now'}`)]) }
}

async function grepFiles(args: string[], ctx: ShellContext) {
  const flags = args.filter((arg) => /^-[a-z]+$/.test(arg))
  const [pattern, ...targets] = args.filter((arg) => !/^-[a-z]+$/.test(arg))
  if (!pattern) { ctx.print([err('usage: grep [-iv] <pattern> [file ...]   (searches every file when none is given)')]); return }
  const files = targets.length ? targets.map((target) => readFile(target, ctx.path) ?? { name: target, text: '' }) : allFiles()
  const hits = files.flatMap((file) => {
    const matched = grepLines(file.text.split('\n'), [...flags.filter((flag) => flag !== '-c'), pattern])
    return Array.isArray(matched) ? matched.map((line) => `${cmd(file.name, `cat ${file.name.replace(/\.md$/, '')}`)}: ${escapeMd(line.trim())}`) : []
  })
  ctx.print([hits.length ? out(hits.join('\n')) : muted(`grep: no matches for '${pattern}'`)])
}

function fileFilter(name: string) {
  return (args: string[], ctx: ShellContext) => {
    const target = args.find((arg) => !arg.startsWith('-') && !/^\d+$/.test(arg))
    const file = target ? readFile(target, ctx.path) : undefined
    if (!file) { ctx.print([err(target ? `${name}: ${target}: No such file or directory` : `usage: ${name} <file>  (or pipe into it: cat about | ${name})`)]); return }
    const result = filters[name]!(file.text.split('\n'), args.filter((arg) => arg !== target))
    ctx.print([Array.isArray(result) ? out(fence(result.join('\n'))) : err(result.error)])
  }
}

function openVim(args: string[], ctx: ShellContext) {
  const target = args.find((arg) => !arg.startsWith('-') && !arg.startsWith('+'))
  if (!target) { ctx.ui.vim('', ''); return }
  const file = readFile(target, ctx.path)
  ctx.ui.vim(file?.name ?? clean(target), file?.text ?? '')
}

export function openTargets(): Record<string, string> {
  return { github: profile.github, ...(profile.linkedin ? { linkedin: profile.linkedin } : {}), source: profile.source, ...extraLinks, email: `mailto:${profile.email}` }
}

// One command per ABOUT.md section. Known sections keep their live behaviour;
// any other heading prints its markdown.
const sectionRunners: Record<string, Pick<Command, 'run' | 'usage'>> = {
  projects: { usage: 'projects [name]', run: (args, ctx) => showProjects(ctx, args[0]) },
  now: { run: (_args, ctx) => now(ctx) },
  guestbook: { usage: 'guestbook [sign [--name <name>] [message]]', run: guestbook },
}

function sectionCommands(): Record<string, Command> {
  return Object.fromEntries(sectionList.filter(({ id }) => id !== 'help').map(({ id, help }) => [id, { group: 'Portfolio', summary: help, ...(sectionRunners[id] ?? { run: (_args: string[], ctx: ShellContext) => ctx.print([section(id)]) }) } satisfies Command]))
}

export const commands: Record<string, Command> = {
  help: { group: 'Terminal', summary: 'list commands', run: (_args, ctx) => {
    const groups = ['Portfolio', 'Navigation', 'Terminal', 'Fun'] as const
    ctx.print([
      ...groups.flatMap((group) => [{ type: 'success' as const, text: group }, out(Object.entries(commands).filter(([, command]) => command.group === group && !command.hidden).map(([name, command]) => `  ${cmd(name.padEnd(13), name)}${command.summary}`).join('\n'))]),
      muted(`Anything that is not a command goes to my AI assistant, e.g. "${exampleQuestion}"`),
      muted('zsh keys work: Tab, ^A ^E ^U ^K ^W ^Y ^L ^C ^R, ⌥B ⌥F, ↑↓, → accepts a suggestion, !! and !$. See `shortcuts`.'),
    ])
  } },
  ...sectionCommands(),
  resume: { group: 'Portfolio', summary: 'open my resume (PDF)', run: (args, ctx) => {
    ctx.print([{ type: 'success', text: `[${profile.resume.split('/').pop()}](${profile.resume}) (opening in a new tab)` }])
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
    const guess = closest(dir, directories)
    ctx.print([err(`cd: no such file or directory: ${destination}`), ...didYouMean(guess, `cd ${guess}`)])
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
    if (base === '.zshrc') { ctx.print([out(fence(zshrc()))]); return }
    if (base === 'resume.md') { ctx.print([out(fence(resumeText()))]); return }
    if (base === 'projects' && file) return showProjects(ctx, file)
    if (base === 'media' && file) return viewMedia(ctx, file)
    if (commands[base] && directories.includes(base) && base !== 'projects' && base !== 'media') return commands[base]!.run([], ctx)
    if (base === 'projects') return showProjects(ctx)
    const guess = closest(base, [...directories, ...fileNames])
    ctx.print([err(`cat: ${target}: No such file or directory`), ...didYouMean(guess, `cat ${guess}`)])
  } },
  tree: { group: 'Navigation', summary: 'show the whole site map', run: async (_args, ctx) => {
    let projectNames: string[] = []
    try { projectNames = (await ctx.projects()).map((project) => project.name) } catch { projectNames = ['(GitHub unreachable)'] }
    const lines = ['~', ...directories.flatMap((dir) => {
      const children = dir === 'projects' ? projectNames : dir === 'media' ? [...Object.keys(mediaFiles), 'screenshots/'] : [`${dir}.md`]
      return [`├── ${dir}/`, ...children.map((child, childIndex) => `│   ${childIndex === children.length - 1 ? '└──' : '├──'} ${child}`)]
    }), '├── .zshrc', '├── resume.md', '└── README.md']
    ctx.print([out(fence(lines.join('\n')))])
  } },
  view: { group: 'Navigation', summary: 'show an image, diagram or project screenshot', usage: 'view <file>', run: (args, ctx) => viewMedia(ctx, args[0]) },
  open: { group: 'Navigation', summary: 'open a project, github, linkedin or the source', usage: 'open <target>', run: async (args, ctx) => {
    const target = (args[0] ?? '').toLowerCase()
    const known = openTargets()
    if (known[target]) { ctx.print([muted(`opening ${known[target]} ...`)]); openExternal(known[target]!); return }
    try {
      const project = (await ctx.projects()).find((item) => item.name.toLowerCase() === target)
      if (project) { ctx.print([muted(`opening ${project.url} ...`)]); openExternal(project.url); return }
    } catch { /* fall through to the error below */ }
    ctx.print([err(`open: ${args[0] ?? ''}: unknown target. Try ${Object.keys(known).filter((key) => key !== 'email').join(', ')} or a project name.`)])
  } },
  clear: { group: 'Terminal', summary: 'clear the screen (^L)', run: (_args, ctx) => ctx.clear() },
  history: { group: 'Terminal', summary: 'command history (^R to search)', run: (_args, ctx) => ctx.print([out(ctx.history.map((item, index) => `${String(index + 1).padStart(5)}  ${item}`).join('\n') || 'No commands yet.')]) },
  theme: { group: 'Terminal', summary: `switch colours: ${themeNames.join(', ')}, crt`, usage: 'theme [name]', run: (args, ctx) => {
    const name = args[0]
    if (!name) { ctx.print([out(themeNames.map((theme) => `${theme === ctx.theme ? '●' : '○'} ${cmd(theme, `theme ${theme}`)}  ${themes[theme].label}`).join('\n') + `\n${ctx.ui.crt ? '●' : '○'} ${cmd('crt', 'theme crt')}  CRT scanlines (toggle)`)]); return }
    if (name === 'crt' || name === 'scanlines') return commands.crt!.run([], ctx)
    if (!isThemeName(name)) { const guess = closest(name, themeNames); ctx.print([err(`theme: unknown theme '${name}'`), ...didYouMean(guess, `theme ${guess}`)]); return }
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
  whoami: { group: 'Terminal', summary: 'print effective user', hidden: true, run: (_args, ctx) => ctx.print([out(`guest  (but you can ask about ${profile.handle})`)]) },
  date: { group: 'Terminal', summary: 'print the date', hidden: true, run: (_args, ctx) => ctx.print([out(new Date().toString())]) },
  echo: { group: 'Terminal', summary: 'print text', hidden: true, run: (args, ctx) => ctx.print([out(args.join(' ').replace(/^['"]|['"]$/g, '').replace(/\$USER/g, 'guest').replace(/\$SHELL/g, '/bin/zsh').replace(/\$HOME/g, `/home/${profile.handle}`))]) },
  uname: { group: 'Terminal', summary: 'system info', hidden: true, run: (args, ctx) => ctx.print([out(args.includes('-a') ? `${os.name} ${profile.host} ${os.version} Kernel Version ${os.version.split(' ')[0]}.0 React-19 x86_64 Lightsail/nano zsh` : os.name)]) },
  sw_vers: { group: 'Terminal', summary: 'OS version', hidden: true, run: (_args, ctx) => ctx.print([out(fence(`ProductName:\t\t${os.name}\nProductVersion:\t\t${os.version}\nBuildVersion:\t\t26K1004`))]) },
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
  sudo: { group: 'Fun', summary: 'try it', hidden: true, run: async (args, ctx) => {
    const line = args.join(' ')
    if (isRootWipe(args.slice(1)) && args[0] === 'rm') return meltdown(ctx)
    if (line === 'make me a sandwich') { ctx.print([{ type: 'success', text: 'Okay.' }]); return }
    ctx.print([muted('[sudo] password for guest: ********'), err(`Nice try. guest is not in the sudoers file. This incident will be reported to ${profile.handle}.`)])
  } },
  rm: { group: 'Fun', summary: 'remove files', hidden: true, run: (args, ctx) => isRootWipe(args) ? meltdown(ctx) : ctx.print([err(`rm: ${args.filter((arg) => !arg.startsWith('-')).join(' ') || 'file'}: Permission denied (read-only portfolio filesystem)`)]) },
  make: { group: 'Fun', summary: 'build something', hidden: true, run: (args, ctx) => ctx.print([args.join(' ') === 'me a sandwich' ? err('What? Make it yourself.') : err(`make: *** No rule to make target '${args[0] ?? ''}'.  Stop.`)]) },
  vim: { group: 'Navigation', summary: 'open a file in vim (try vim resume)', usage: 'vim <file>', run: openVim },
  vi: { group: 'Navigation', summary: 'vim', hidden: true, run: openVim },
  nvim: { group: 'Navigation', summary: 'vim', hidden: true, run: openVim },
  nano: { group: 'Fun', summary: 'editor', hidden: true, run: (args, ctx) => { ctx.print([muted('nano? In this house we use vim.')]); openVim(args, ctx) } },
  emacs: { group: 'Fun', summary: 'editor', hidden: true, run: (_args, ctx) => ctx.print([muted('emacs: a great operating system, lacking only a decent editor. Try `vim resume`.')]) },
  less: { group: 'Navigation', summary: 'page through a file', hidden: true, run: (args, ctx) => commands.cat!.run(args, ctx) },
  more: { group: 'Navigation', summary: 'page through a file', hidden: true, run: (args, ctx) => commands.cat!.run(args, ctx) },
  ':q': { group: 'Fun', summary: 'quit vim', hidden: true, run: (_args, ctx) => ctx.print([{ type: 'success', text: 'You are not in vim, but the reflex is admirable. Achievement unlocked.' }]) },
  sl: { group: 'Fun', summary: 'steam locomotive', hidden: true, run: (_args, ctx) => ctx.print([{ type: 'ascii', text: train }, muted('You meant `ls`. The train was faster.')]) },
  xyzzy: { group: 'Fun', summary: 'magic word', hidden: true, run: (_args, ctx) => ctx.print([muted('Nothing happens.')]) },
  snake: { group: 'Fun', summary: 'play snake (arrows / WASD / hjkl)', run: (_args, ctx) => { ctx.print([muted('starting snake ... press q to quit')]); ctx.ui.game('snake') } },
  '2048': { group: 'Fun', summary: 'play 2048 (arrows / WASD / swipe)', run: (_args, ctx) => { ctx.print([muted('starting 2048 ... press q to quit')]); ctx.ui.game('2048') } },
  crt: { group: 'Terminal', summary: 'toggle CRT scanlines', usage: 'crt [on|off]', run: (args, ctx) => {
    const on = args[0] === 'on' ? true : args[0] === 'off' ? false : !ctx.ui.crt
    ctx.ui.setCrt(on)
    ctx.print([{ type: 'success', text: `CRT scanlines ${on ? 'on' : 'off'}` }])
  } },
  grep: { group: 'Navigation', summary: 'search every file (or pipe into it)', usage: 'grep [-iv] <pattern> [file]', run: grepFiles },
  head: { group: 'Navigation', summary: 'first lines of a file', hidden: true, run: fileFilter('head') },
  tail: { group: 'Navigation', summary: 'last lines of a file', hidden: true, run: fileFilter('tail') },
  wc: { group: 'Navigation', summary: 'count lines, words, chars', hidden: true, run: fileFilter('wc') },
  contributions: { group: 'Portfolio', summary: 'my GitHub contribution graph, in ASCII', run: (_args, ctx) => contributions(ctx) },
  gui: { group: 'Portfolio', summary: 'open the standard portfolio website', run: (_args, ctx) => { ctx.print([muted('launching Chrome ...')]); ctx.ui.openBrowser() } },
  share: { group: 'Terminal', summary: 'copy a link that runs a command', usage: 'share [command]', run: async (args, ctx) => {
    const command = args.join(' ') || [...ctx.history].reverse().find((item) => !item.startsWith('share')) || 'help'
    const url = siteUrl(command)
    let copied = false
    try { await navigator.clipboard.writeText(url); copied = true } catch { /* clipboard blocked */ }
    ctx.print([out(`[${url}](${url})`), muted(copied ? 'copied to clipboard' : 'copy the link above to share it')])
  } },
  ssh: { group: 'Fun', summary: 'connect to a host', hidden: true, run: (_args, ctx) => ctx.print([muted(`You are already connected to ${profile.host}. Run \`reboot\` to replay the login.`)]) },
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
