import { useEffect, useMemo, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkBreaks from 'remark-breaks'
import remarkGfm from 'remark-gfm'
import './App.css'

type TranscriptLine = { id: number; type: 'command' | 'output' | 'muted' | 'success' | 'error' | 'media'; text: string; media?: { src: string; alt: string } }

const directories = ['about', 'projects', 'experience', 'skills', 'publications', 'contact', 'resume', 'media']
const commands = ['about', 'cat', 'cd', 'clear', 'contact', 'cowthink', 'experience', 'fortune', 'github', 'help', 'history', 'ls', 'media', 'projects', 'publications', 'pwd', 'resume', 'skills', 'view']
const files: Record<string, string[]> = { projects: ['agentic-ai.md', 'sd-parsers.md', 'research.md', 'portfolio-os.md'], media: ['profile.svg'] }
const content: Record<string, string[]> = {
  about: ['# Deepratna Awale', '', '**Senior Software Engineer at Nasdaq** building agentic AI systems, scalable cloud applications, and reliable data pipelines.', '', '**Certification:** AWS Certified Machine Learning Engineer - Associate', '**Education:** MASc Computer Engineering, Memorial University of Newfoundland', '', 'Try `cd projects` or ask me a question in plain English.'],
  projects: ['agentic-ai/       sd-parsers/       research/      portfolio-os/', '', 'Use `cat projects/agentic-ai.md` to inspect a project.', 'Use `media` to see the portfolio multimedia surface.'],
  experience: ['## Senior Software Engineer', '**Nasdaq** [June 2026 - Present] | St. John\'s, NL', '', '- Building production software and applied AI systems.', '- Owning work across architecture, development, deployment, and operations.', '', '## Generative AI Associate', '**Innodata Inc.** [August 2025 - May 2026] | Ontario, Canada', '', '- Evaluated and rated AI model outputs for quality, relevance, and accuracy for Meta.', '- Contributed to internal tools for toxicity testing and benchmark metrics.', '- Supported dataset development through data collection and augmentation to reduce model overfitting.'],
  skills: ['Agentic AI Development  Cloud Computing  OpenCV', 'AWS  Terraform  CI/CD  Full-stack AI applications', 'Python  TypeScript  React  Data pipelines  Computer vision'],
  publications: ['Monolog: Theoretical Answer Evaluation System', 'How Did I - Get Started with Machine Learning', 'Semantic Analysis Of Long Answers', '', 'Research interests: evaluation, language understanding, and applied AI.'],
  contact: ['email     [awale.deep@gmail.com](mailto:awale.deep@gmail.com)', 'phone     [+1 709 341 7268](tel:+17093417268)', 'linkedin  [linkedin.com/in/deepratna-awale](https://www.linkedin.com/in/deepratna-awale)', 'web       [sd-parsers.vercel.app](https://sd-parsers.vercel.app)', '', 'For a thoughtful conversation, email is the fastest route.'],
  resume: ['resume.pdf is available from the source resume and will be linked here at launch.', '', 'Certifications', '  AWS Certified Machine Learning Engineer - Associate', '  IBM Data Science Professional Specialization', '', 'Education', '  MASc, Computer Engineering - Memorial University of Newfoundland'],
  media: ['profile.svg     project screenshots     architecture diagrams', '', 'Use `view profile.svg` to preview an image inline.', 'Project media is served from version-controlled `/public/media` assets.'],
}
const initialTranscript: TranscriptLine[] = [
  { id: 1, type: 'muted', text: 'Last login: today on ttys001' },
  { id: 2, type: 'output', text: 'Welcome to deepratna-awale.dev' },
  { id: 3, type: 'muted', text: 'A terminal-shaped portfolio. Type `help` to explore.' },
]

function tokenize(input: string): string[] { return input.match(/(?:[^\s"']|"[^"]*"|'[^']*')+/g) ?? [] }

function completionFor(input: string): string {
  if (!input) return ''
  const tokens = tokenize(input)
  if (tokens.length === 1) {
    const match = commands.find((command) => command.startsWith(input) && command !== input)
    return match ? match.slice(input.length) : ''
  }
  const command = tokens[0]
  if (command !== 'cd' && command !== 'cat' && command !== 'view') return ''
  const partial = tokens[tokens.length - 1] ?? ''
  const slashIndex = partial.lastIndexOf('/')
  const directory = slashIndex === -1 ? '' : partial.slice(0, slashIndex).replace(/^~\//, '')
  const fragment = slashIndex === -1 ? partial : partial.slice(slashIndex + 1)
  const options = command === 'cd' ? directories : directory ? (files[directory] ?? []) : [...directories, 'README.md']
  const match = options.find((option) => option.startsWith(fragment) && option !== fragment)
  return match ? match.slice(fragment.length) : ''
}

function fencedText(text: string): string {
  return `\`\`\`text\n${text}\n\`\`\``
}

async function fetchFortune(): Promise<string> {
  const response = await fetch('/api/fortune')
  if (!response.ok) throw new Error(await response.text())
  return response.text()
}

async function fetchCowthink(text: string): Promise<string> {
  const response = await fetch(`/api/cowthink?text=${encodeURIComponent(text)}`)
  if (!response.ok) throw new Error(await response.text())
  return response.text()
}

function App() {
  const [transcript, setTranscript] = useState(initialTranscript)
  const [input, setInput] = useState('')
  const [path, setPath] = useState('~')
  const [history, setHistory] = useState<string[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const [showScrollButton, setShowScrollButton] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const terminalRef = useRef<HTMLDivElement>(null)
  const promptPath = path === '~' ? '~' : `~/${path}`
  const completion = useMemo(() => completionFor(input), [input])

  useEffect(() => {
    if (!showScrollButton) terminalRef.current?.scrollTo({ top: terminalRef.current.scrollHeight })
  }, [transcript, showScrollButton])

  const handleTerminalScroll = () => {
    const terminal = terminalRef.current
    if (!terminal) return
    setShowScrollButton(terminal.scrollHeight - terminal.scrollTop - terminal.clientHeight > 80)
  }

  const scrollToLatest = () => {
    setShowScrollButton(false)
    terminalRef.current?.scrollTo({ top: terminalRef.current.scrollHeight, behavior: 'smooth' })
    inputRef.current?.focus()
  }

  const append = (lines: Array<Omit<TranscriptLine, 'id'>>) => setTranscript((current) => [...current, ...lines.map((line, index) => ({ ...line, id: Date.now() + index }))])

  const runCommand = async (rawCommand: string) => {
    const trimmed = rawCommand.trim()
    if (!trimmed) return
    const tokens = tokenize(trimmed)
    const command = tokens[0]!.toLowerCase()
    const args = tokens.slice(1)
    const pipeIndex = tokens.indexOf('|')
    setHistory((current) => [...current.filter((item) => item !== trimmed), trimmed])
    setHistoryIndex(-1)
    append([{ type: 'command', text: `${promptPath} % ${trimmed}` }])
    if (pipeIndex !== -1) {
      const left = tokens.slice(0, pipeIndex).join(' ')
      const right = tokens.slice(pipeIndex + 1).join(' ')
      if (left === 'fortune' && right === 'cowthink') {
        try { append([{ type: 'output', text: fencedText(await fetchCowthink(await fetchFortune())) }]) }
        catch (error) { append([{ type: 'error', text: error instanceof Error ? error.message : 'fortune is unavailable' }]) }
      } else if (right === 'cowthink') {
        const phrase = left.replace(/^echo\s+/, '').replace(/^['"]|['"]$/g, '')
        try { append([{ type: 'output', text: fencedText(await fetchCowthink(phrase)) }]) }
        catch (error) { append([{ type: 'error', text: error instanceof Error ? error.message : 'cowthink is unavailable' }]) }
      } else append([{ type: 'error', text: `zsh: command not found: ${right}` }])
      return
    }
    switch (command) {
      case 'clear': setTranscript([]); return
      case 'help': append([{ type: 'output', text: 'Navigation' }, { type: 'muted', text: '  ls, cd <dir>, pwd, cat <file>, view <image>' }, { type: 'output', text: 'Portfolio' }, { type: 'muted', text: '  about, projects, experience, skills, publications, contact, resume, media' }, { type: 'output', text: 'Terminal' }, { type: 'muted', text: '  clear, history, fortune, cowthink "text", github' }, { type: 'success', text: 'Tip: try an unlisted request like "what is your strongest project?"' }]); return
      case 'pwd': append([{ type: 'output', text: `/${path === '~' ? '' : path}` }]); return
      case 'ls': append([{ type: 'output', text: path === '~' ? `${directories.join('  ')}\nREADME.md  .profile` : (content[path] ?? ['No files here.']).join('\n') }]); return
      case 'cd': {
        const destination = args[0] ?? '~'
        if (destination === '..' || destination === '~' || destination === '/') { setPath('~'); return }
        const cleanDestination = destination.replace(/^~\//, '').replace(/^\//, '')
        if (directories.includes(cleanDestination)) { setPath(cleanDestination); return }
        append([{ type: 'error', text: `cd: no such directory: ${destination}` }]); return
      }
      case 'cat': {
        const requested = args[0]?.replace(/^~\//, '').replace(/^\//, '')
        const directory = requested?.split('/')[0]
        if (directory && content[directory]) append([{ type: 'output', text: content[directory].join('\n') }])
        else append([{ type: 'error', text: `cat: ${args[0] ?? 'missing file'}: No such file` }])
        return
      }
      case 'about': case 'projects': case 'experience': case 'skills': case 'publications': case 'contact': case 'resume': case 'media': append([{ type: 'output', text: content[command].join('\n') }]); return
      case 'view': {
        const requested = args[0] ?? 'profile.svg'
        if (requested === 'profile.svg' || requested === 'profile') {
          append([{ type: 'media', text: 'profile.svg', media: { src: '/media/profile.svg', alt: 'Abstract profile illustration for Deepratna Awale' } }])
        } else append([{ type: 'error', text: `view: ${requested}: Media asset not found` }])
        return
      }
      case 'history': append([{ type: 'output', text: history.map((item, index) => `  ${index + 1}  ${item}`).join('\n') || 'No commands yet.' }]); return
      case 'fortune':
        try { append([{ type: 'output', text: await fetchFortune() }]) }
        catch (error) { append([{ type: 'error', text: error instanceof Error ? error.message : 'fortune is unavailable' }]) }
        return
      case 'cowthink': {
        const phrase = args.join(' ').replace(/^['"]|['"]$/g, '') || 'moo'
        try { append([{ type: 'output', text: fencedText(await fetchCowthink(phrase)) }]) }
        catch (error) { append([{ type: 'error', text: error instanceof Error ? error.message : 'cowthink is unavailable' }]) }
        return
      }
      case 'github': append([{ type: 'success', text: 'GitHub integration is queued for the next release.' }]); return
      default: append([{ type: 'muted', text: 'This is outside the built-in command set. Asking the portfolio assistant...' }, { type: 'output', text: `I can help with this portfolio. I understood “${trimmed}” as a request to explore Deepratna Awale's work. Try ` + '`projects`' + ', `about`, or `experience`.' }])
    }
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') { runCommand(input); setInput('') }
    else if (event.key === 'ArrowUp') { event.preventDefault(); const nextIndex = Math.min(historyIndex + 1, history.length - 1); setHistoryIndex(nextIndex); setInput(history[history.length - 1 - nextIndex] ?? '') }
    else if (event.key === 'ArrowDown') { event.preventDefault(); const nextIndex = Math.max(historyIndex - 1, -1); setHistoryIndex(nextIndex); setInput(nextIndex === -1 ? '' : history[history.length - 1 - nextIndex] ?? '') }
    else if (event.key === 'Tab') { event.preventDefault(); setInput(input + completion) }
  }

  return (
    <main className="app-shell">
      <div className="desktop-only terminal-window">
        <header className="window-chrome"><div className="traffic-lights" aria-hidden="true"><span /><span /><span /></div><div className="window-title">deepratna — zsh — 120×32</div><div className="window-actions" aria-hidden="true">⌘  ⌕</div></header>
        <div className="terminal-body" ref={terminalRef} onScroll={handleTerminalScroll} role="log" aria-live="polite">
          {transcript.map((line) => line.type === 'media' && line.media ? <div key={line.id} className="terminal-line media-line"><span>{line.text}</span><img src={line.media.src} alt={line.media.alt} /></div> : <div key={line.id} className={`terminal-line ${line.type}`}>{line.type === 'command' ? line.text : <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]} components={{ a: (props) => <a {...props} target="_blank" rel="noreferrer" /> }}>{line.text}</ReactMarkdown>}</div>)}
          <div className="input-row"><span className="prompt"><span className="prompt-user">deepratna@portfolio</span><span className="prompt-path"> {promptPath}</span><span className="prompt-symbol"> %</span></span><span className="input-shell"><span className="ghost-text" aria-hidden="true"><span>{input}</span><span className="completion">{completion}</span></span><input ref={inputRef} value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={handleKeyDown} aria-label="Terminal command input" autoFocus spellCheck={false} /></span></div>
        </div>
        {showScrollButton && <button className="scroll-to-latest" type="button" onClick={scrollToLatest} aria-label="Scroll to latest terminal output">↓</button>}
        <footer className="terminal-footer"><span>zsh</span><span>UTF-8</span><span>main</span><span className="footer-status">● connection local</span></footer>
      </div>
      <section className="mobile-message"><div className="mobile-mark">⌘</div><p className="eyebrow">alex-morgan.dev</p><h1>Open this portfolio on a desktop.</h1><p>The terminal experience is designed for a full keyboard and a larger screen.</p></section>
    </main>
  )
}

export default App
