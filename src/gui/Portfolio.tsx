import { useCallback, useEffect, useRef, useState, type FormEvent, type MouseEvent, type ReactNode } from 'react'
import ReactMarkdown, { defaultUrlTransform, type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { ArrowUpRight, Award, BookOpen, FileText, GraduationCap, Mail, MapPin, Menu, Moon, RotateCw, Send, SquareTerminal, Star, Sun, X } from 'lucide-react'
import { fetchContributions, fetchGuestbook, fetchProjects, signGuestbook, type Contributions, type GuestbookEntry, type Project } from '../api'
import { nowItems, profile, sections } from '../content'
import { parseAbout, parseEducation, parseExperience, parsePublications, parseSkills, splitYear } from './parse'
import './Portfolio.css'

type Theme = 'dark' | 'light'
type Props = {
  embedded?: boolean
  prerender?: boolean
  anchor?: string
  onExternal?: (url: string) => void
  onOpenTerminal?: () => void
  onAnchor?: (id: string) => void
}

const nav = [
  ['about', 'About'], ['experience', 'Experience'], ['projects', 'Projects'], ['skills', 'Skills'], ['publications', 'Research'],
  ['education', 'Education'], ['now', 'Now'], ['guestbook', 'Guestbook'], ['contact', 'Contact'],
] as const
const sectionIds = new Set<string>(nav.map(([id]) => id))
const themeKey = 'portfolio.gui.theme'
const MAX_MESSAGE = 280

const about = parseAbout(sections.about ?? [])
const experience = parseExperience(sections.experience ?? [])
const skills = parseSkills(sections.skills ?? [])
const papers = parsePublications(sections.publications ?? [])
const education = parseEducation(sections.education ?? [])

function initialTheme(): Theme {
  try { const saved = localStorage.getItem(themeKey); if (saved === 'dark' || saved === 'light') return saved } catch { /* storage unavailable */ }
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}

const opensElsewhere = (href: string) => /^(https?:|mailto:)/i.test(href) || href.startsWith('/media/')
const linkAttrs = (href: string) => (opensElsewhere(href) && !href.startsWith('mailto:') ? { target: '_blank', rel: 'noopener noreferrer' } : {})

const markdownLinks: Components = {
  a: ({ href = '', children }) => {
    if (href.startsWith('cmd:')) {
      const id = href.slice(4)
      return sectionIds.has(id) ? <a href={`#${id}`}>{children}</a> : <>{children}</>
    }
    return <a href={href} {...linkAttrs(href)}>{children}</a>
  },
}
const inlineComponents: Components = { ...markdownLinks, p: ({ children }) => <>{children}</> }
const transform = (url: string) => (url.startsWith('cmd:') ? url : defaultUrlTransform(url))

function Md({ children, inline = false }: { children: string; inline?: boolean }) {
  return <ReactMarkdown remarkPlugins={[remarkGfm]} urlTransform={transform} components={inline ? inlineComponents : markdownLinks}>{children}</ReactMarkdown>
}

function GitHubIcon() {
  return <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="currentColor"><path d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.05-.71.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.68 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.41-2.69 5.38-5.25 5.67.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5Z" /></svg>
}
function LinkedInIcon() {
  return <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="currentColor"><path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.86 0-2.14 1.45-2.14 2.94v5.67H9.34V9h3.42v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28ZM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13ZM7.12 20.45H3.56V9h3.56v11.45ZM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0Z" /></svg>
}

function Section({ id, index, title, embedded, children, wide = false }: { id: string; index: number; title: string; embedded: boolean; children: ReactNode; wide?: boolean }) {
  return (
    <section className={`pf-section${wide ? ' pf-wide' : ''}`} id={embedded ? undefined : id} data-section={id} aria-label={title}>
      <header className="pf-section-head">
        <span className="pf-eyebrow">{String(index).padStart(2, '0')} / {id}</span>
        <h2>{title}</h2>
      </header>
      {children}
    </section>
  )
}

const formatMonth = (iso: string) => {
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('en', { month: 'short', year: 'numeric' })
}

function ProjectCard({ project }: { project: Project }) {
  const [imageOk, setImageOk] = useState(true)
  const bullets = project.bullets.length ? project.bullets : [project.description || 'No description yet.']
  return (
    <article className="pf-card pf-project">
      {imageOk && project.image && (
        <a className="pf-project-image" href={project.url} {...linkAttrs(project.url)} tabIndex={-1} aria-hidden="true">
          <img src={project.image} alt="" width={1280} height={640} loading="lazy" decoding="async" onError={() => setImageOk(false)} />
        </a>
      )}
      <div className="pf-project-body">
        <h3><a href={project.url} {...linkAttrs(project.url)}>{project.name}</a></h3>
        <p className="pf-project-meta">
          {project.language && <span className="pf-lang"><span className="pf-lang-dot" aria-hidden="true" />{project.language}</span>}
          {project.stars > 0 && <span><Star size={13} aria-hidden="true" /> {project.stars}</span>}
          {formatMonth(project.pushedAt) && <span>Updated {formatMonth(project.pushedAt)}</span>}
        </p>
        <ul className="pf-bullets">{bullets.slice(0, 3).map((bullet) => <li key={bullet}><Md inline>{bullet}</Md></li>)}</ul>
        <div className="pf-card-links">
          <a href={project.url} {...linkAttrs(project.url)}><GitHubIcon /> Code</a>
          {project.homepage && <a href={project.homepage} {...linkAttrs(project.homepage)}><ArrowUpRight size={15} aria-hidden="true" /> Live</a>}
        </div>
      </div>
    </article>
  )
}

function Projects() {
  const [projects, setProjects] = useState<Project[] | null>(null)
  const [error, setError] = useState('')
  const load = useCallback(() => {
    let cancelled = false
    fetchProjects().then((list) => { if (!cancelled) setProjects(list) }).catch((reason: unknown) => { if (!cancelled) setError(reason instanceof Error ? reason.message : 'could not load projects') })
    return () => { cancelled = true }
  }, [])
  useEffect(load, [load])
  const retry = () => { setError(''); setProjects(null); load() }

  if (error) return (
    <div className="pf-card pf-state" role="alert">
      <p>Projects could not be loaded right now. <span className="pf-muted">({error})</span></p>
      <div className="pf-card-links"><button type="button" onClick={retry}><RotateCw size={15} aria-hidden="true" /> Try again</button><a href={profile.github} {...linkAttrs(profile.github)}><GitHubIcon /> Browse on GitHub</a></div>
    </div>
  )
  if (!projects) return (
    <div className="pf-grid pf-projects" aria-busy="true" aria-label="Loading projects">
      {[0, 1, 2].map((key) => <div key={key} className="pf-card pf-skeleton"><span className="pf-sk-image" /><span className="pf-sk-line w60" /><span className="pf-sk-line w90" /><span className="pf-sk-line w75" /></div>)}
    </div>
  )
  if (!projects.length) return <p className="pf-muted">No public projects yet. <a href={profile.github} {...linkAttrs(profile.github)}>See GitHub</a>.</p>
  return <div className="pf-grid pf-projects">{projects.map((project) => <ProjectCard key={project.name} project={project} />)}</div>
}

function Heatmap() {
  const [data, setData] = useState<Contributions | null>(null)
  const scroller = useRef<HTMLDivElement>(null)
  useEffect(() => {
    let cancelled = false
    fetchContributions().then((value) => { if (!cancelled && value.days?.length) setData(value) }).catch(() => {})
    return () => { cancelled = true }
  }, [])
  useEffect(() => { const el = scroller.current; if (el) el.scrollLeft = el.scrollWidth }, [data])
  if (!data) return null
  const days = data.days.slice(-364)
  const offset = new Date(`${days[0]!.date}T00:00:00Z`).getUTCDay()
  return (
    <figure className="pf-card pf-heat">
      <figcaption><strong>{data.total.toLocaleString('en')}</strong> GitHub contributions in the last year</figcaption>
      <div className="pf-heat-scroll" ref={scroller}>
        <div className="pf-heat-grid" role="img" aria-label={`Contribution heatmap: ${data.total} contributions in the last year`}>
          {Array.from({ length: offset }, (_, index) => <span key={`pad-${index}`} className="pf-heat-pad" />)}
          {days.map((day) => <span key={day.date} className={`pf-heat-cell l${Math.max(0, Math.min(4, day.level))}`} title={`${day.count} contribution${day.count === 1 ? '' : 's'} on ${day.date}`} />)}
        </div>
      </div>
      <div className="pf-heat-legend" aria-hidden="true">Less {[0, 1, 2, 3, 4].map((level) => <span key={level} className={`pf-heat-cell l${level}`} />)} More</div>
    </figure>
  )
}

function Guestbook({ live }: { live: boolean }) {
  const [entries, setEntries] = useState<GuestbookEntry[] | null>(null)
  const [loadError, setLoadError] = useState('')
  const [name, setName] = useState('')
  const [message, setMessage] = useState('')
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null)
  const [sending, setSending] = useState(false)
  useEffect(() => {
    if (!live) return
    let cancelled = false
    fetchGuestbook().then((list) => { if (!cancelled) setEntries(list) }).catch((reason: unknown) => { if (!cancelled) setLoadError(reason instanceof Error ? reason.message : 'the guestbook is unavailable') })
    return () => { cancelled = true }
  }, [live])

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (sending || message.trim().length < 2) return
    setSending(true); setStatus(null)
    signGuestbook(name.trim(), message.trim())
      .then((entry) => { setEntries((list) => [entry, ...(list ?? [])]); setMessage(''); setStatus({ ok: true, text: 'Signed. Thank you for stopping by!' }) })
      .catch((reason: unknown) => setStatus({ ok: false, text: reason instanceof Error ? reason.message : 'could not sign the guestbook' }))
      .finally(() => setSending(false))
  }

  if (!live) return <p className="pf-muted">Leave a note: the guestbook needs JavaScript, or sign it from the <a href="/">terminal</a> with <code>guestbook sign</code>.</p>
  return (
    <div className="pf-guestbook">
      <form className="pf-card pf-form" onSubmit={submit}>
        <label><span>Name <span className="pf-muted">(optional)</span></span><input value={name} maxLength={32} autoComplete="nickname" placeholder="guest" onChange={(event) => setName(event.target.value)} /></label>
        <label><span>Message</span><textarea value={message} maxLength={MAX_MESSAGE} rows={3} required placeholder="Say hi, leave a tip, or tell me what you're building." onChange={(event) => setMessage(event.target.value)} /></label>
        <div className="pf-form-foot">
          <span className={`pf-count${message.length > MAX_MESSAGE - 20 ? ' warn' : ''}`}>{message.length}/{MAX_MESSAGE}</span>
          <button type="submit" className="pf-btn primary" disabled={sending || message.trim().length < 2}><Send size={15} aria-hidden="true" /> {sending ? 'Signing…' : 'Sign guestbook'}</button>
        </div>
        {status && <p className={`pf-status${status.ok ? ' ok' : ' err'}`} role="status">{status.text}</p>}
      </form>
      <div className="pf-entries" aria-live="polite">
        {loadError && <p className="pf-muted">The guestbook could not be loaded ({loadError}).</p>}
        {!loadError && !entries && <p className="pf-muted">Loading notes…</p>}
        {entries?.length === 0 && <p className="pf-muted">No notes yet. Be the first.</p>}
        {entries && entries.length > 0 && (
          <ul>
            {entries.slice(0, 12).map((entry, index) => (
              <li key={`${entry.at}-${index}`} className="pf-entry">
                <p className="pf-entry-message">{entry.message}</p>
                <p className="pf-entry-meta"><span>{entry.name || 'guest'}</span> · <time dateTime={entry.at}>{formatMonth(entry.at)}</time></p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

export function Portfolio({ embedded = false, prerender = false, anchor, onExternal, onOpenTerminal, onAnchor }: Props) {
  const root = useRef<HTMLDivElement>(null)
  const [theme, setTheme] = useState<Theme>(() => (prerender ? 'dark' : initialTheme()))
  const [menuOpen, setMenuOpen] = useState(false)
  const [active, setActive] = useState('')
  const live = !prerender

  const scrollTo = useCallback((id: string, smooth = true) => {
    const target = id ? root.current?.querySelector(`[data-section="${CSS.escape(id)}"]`) : root.current
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    target?.scrollIntoView({ behavior: smooth && !reduce ? 'smooth' : 'instant', block: 'start' })
  }, [])

  const go = (id: string) => {
    setMenuOpen(false)
    scrollTo(id)
    if (onAnchor) onAnchor(id)
    else if (!embedded) { try { history.replaceState(null, '', id ? `#${id}` : location.pathname) } catch { /* sandboxed */ } }
  }

  const first = useRef(true)
  useEffect(() => {
    const initial = first.current
    first.current = false
    if (anchor !== undefined) { if (anchor || !initial) scrollTo(anchor, !initial) }
    else if (initial && !embedded && location.hash.length > 1) {
      // Wait for the page to settle; the browser's own hash scroll ran against the prerendered markup.
      const id = decodeURIComponent(location.hash.slice(1))
      const timer = setTimeout(() => scrollTo(id, false), 60)
      return () => clearTimeout(timer)
    }
  }, [anchor, embedded, scrollTo])

  useEffect(() => {
    const el = root.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver((records) => {
      for (const record of records) if (record.isIntersecting) setActive((record.target as HTMLElement).dataset.section ?? '')
    }, { rootMargin: '-35% 0px -60% 0px' })
    el.querySelectorAll('[data-section]').forEach((section) => observer.observe(section))
    return () => observer.disconnect()
  }, [])

  const toggleTheme = () => setTheme((current) => {
    const next = current === 'dark' ? 'light' : 'dark'
    try { localStorage.setItem(themeKey, next) } catch { /* storage unavailable */ }
    return next
  })

  const onClick = (event: MouseEvent<HTMLDivElement>) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    const link = (event.target as HTMLElement).closest('a')
    if (!link) return
    const href = link.getAttribute('href') ?? ''
    if (href.startsWith('#')) { event.preventDefault(); go(href.slice(1)); return }
    if (href === '/' && onOpenTerminal) { event.preventDefault(); onOpenTerminal(); return }
    if (!onExternal) return
    let url: URL
    try { url = new URL(href, location.href) } catch { return }
    if (url.protocol === 'mailto:' || url.origin !== location.origin || link.target === '_blank') { event.preventDefault(); onExternal(url.href) }
  }

  const sectionProps = { embedded }
  let index = 0
  const next = () => ++index
  const year = new Date().getFullYear()

  return (
    <div ref={root} className={`pf${embedded ? ' pf-embedded' : ' pf-standalone'}`} data-theme={theme} onClick={onClick}>
      <a className="pf-skip" href="#about">Skip to content</a>
      <nav className="pf-nav" aria-label="Sections">
        <div className="pf-nav-inner">
          <a className="pf-brand" href="#top" onClick={(event) => { event.preventDefault(); go('') }}>
            <span className="pf-logo" aria-hidden="true">DA</span><span className="pf-brand-name">{profile.name}</span>
          </a>
          <ul className={`pf-nav-links${menuOpen ? ' open' : ''}`}>
            {nav.map(([id, label]) => <li key={id}><a href={`#${id}`} aria-current={active === id ? 'true' : undefined}>{label}</a></li>)}
          </ul>
          <div className="pf-nav-actions">
            <button type="button" className="pf-icon-btn" onClick={toggleTheme} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`} title="Toggle theme">{theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}</button>
            <a className="pf-btn ghost pf-term-btn" href="/" title="Open the terminal version"><SquareTerminal size={16} aria-hidden="true" /> <span>Terminal</span></a>
            <button type="button" className="pf-icon-btn pf-menu-btn" onClick={() => setMenuOpen((open) => !open)} aria-expanded={menuOpen} aria-label="Sections menu">{menuOpen ? <X size={18} /> : <Menu size={18} />}</button>
          </div>
        </div>
      </nav>

      <main className="pf-main" id={embedded ? undefined : 'top'}>
        <header className="pf-hero">
          <div className="pf-hero-text">
            <p className="pf-kicker"><span className="pf-pulse" aria-hidden="true" /> Building agentic AI for fraud & AML</p>
            <h1>{profile.name}</h1>
            <p className="pf-role">{profile.title}</p>
            <p className="pf-location"><MapPin size={16} aria-hidden="true" /> {profile.location}</p>
            <p className="pf-pitch"><Md inline>{about.pitch}</Md></p>
            <div className="pf-actions">
              <a className="pf-btn primary" href={profile.resume} {...linkAttrs(profile.resume)}><FileText size={16} aria-hidden="true" /> Resume PDF</a>
              <a className="pf-btn" href={`mailto:${profile.email}`}><Mail size={16} aria-hidden="true" /> Email</a>
              <a className="pf-btn" href={profile.github} {...linkAttrs(profile.github)}><GitHubIcon /> GitHub</a>
              <a className="pf-btn" href={profile.linkedin} {...linkAttrs(profile.linkedin)}><LinkedInIcon /> LinkedIn</a>
              <a className="pf-btn ghost" href="/"><SquareTerminal size={16} aria-hidden="true" /> Open terminal</a>
            </div>
          </div>
          <div className="pf-hero-card" aria-hidden="true">
            <div className="pf-mini-chrome"><span /><span /><span /><em>guest@{profile.host}</em></div>
            <pre>
              <span className="c">$</span> whoami{'\n'}<b>{profile.name}</b>{'\n\n'}
              <span className="c">$</span> cat role{'\n'}{profile.title}{'\n\n'}
              <span className="c">$</span> ls focus/{'\n'}<i>agentic-ai/  evals/  aws/  ml-infra/</i>{'\n\n'}
              <span className="c">$</span> <span className="pf-caret" />
            </pre>
          </div>
        </header>

        <Section id="about" index={next()} title="About" {...sectionProps}>
          <div className="pf-about">
            <div className="pf-prose">{about.prose.map((line) => <Md key={line}>{line}</Md>)}</div>
            <dl className="pf-card pf-facts">
              <div><dt>Role</dt><dd>{profile.title}</dd></div>
              <div><dt>Based in</dt><dd>{profile.location}</dd></div>
              {about.facts.map((fact) => <div key={fact.label}><dt>{fact.label}</dt><dd><Md inline>{fact.value}</Md></dd></div>)}
            </dl>
          </div>
        </Section>

        <Section id="experience" index={next()} title="Experience" {...sectionProps}>
          <ol className="pf-timeline">
            {experience.jobs.map((job) => (
              <li key={`${job.role}-${job.company}`} className="pf-card pf-job">
                <div className="pf-job-head">
                  <div>
                    <h3>{job.role}</h3>
                    <p className="pf-company"><Md inline>{job.company}</Md></p>
                  </div>
                  <p className="pf-job-when"><span className="pf-date">{job.dates}</span><span className="pf-muted">{job.location}</span></p>
                </div>
                {job.notes.map((note) => <p key={note} className="pf-job-note"><Md inline>{note}</Md></p>)}
                <ul className="pf-bullets">{job.bullets.map((bullet) => <li key={bullet}><Md inline>{bullet}</Md></li>)}</ul>
              </li>
            ))}
          </ol>
          {experience.earlier && <p className="pf-muted pf-earlier"><strong>Earlier:</strong> <Md inline>{experience.earlier}</Md></p>}
        </Section>

        <Section id="projects" index={next()} title="Projects" wide {...sectionProps}>
          <p className="pf-lede">Pulled live from GitHub. Each card links to the code and, where there is one, a live demo.</p>
          {prerender ? <div className="pf-grid pf-projects pf-projects-static" dangerouslySetInnerHTML={{ __html: '<!--projects-->' }} /> : <Projects />}
          <p className="pf-more"><a href={profile.github} {...linkAttrs(profile.github)}>All repositories on GitHub <ArrowUpRight size={15} aria-hidden="true" /></a></p>
        </Section>

        <Section id="skills" index={next()} title="Skills" {...sectionProps}>
          <div className="pf-grid pf-skills">
            {skills.map((group) => (
              <div key={group.category} className="pf-card pf-skill-group">
                <h3>{group.category}</h3>
                <ul className="pf-chips">{group.items.map((item) => <li key={item}>{item}</li>)}</ul>
              </div>
            ))}
          </div>
        </Section>

        <Section id="publications" index={next()} title="Publications" {...sectionProps}>
          <div className="pf-grid pf-papers">
            {papers.map((paper) => (
              <article key={paper.title} className="pf-card pf-paper">
                <BookOpen size={20} className="pf-card-icon" aria-hidden="true" />
                {paper.venue && <p className="pf-date">{paper.venue}</p>}
                <h3>{paper.title}</h3>
                <p>{paper.summary}</p>
                {paper.links && <div className="pf-card-links"><Md inline>{paper.links}</Md></div>}
              </article>
            ))}
          </div>
        </Section>

        <Section id="education" index={next()} title="Education & certifications" {...sectionProps}>
          <div className="pf-edu">
            <div className="pf-edu-degrees">
              {education.degrees.map((degree) => {
                const degreeYear = /,\s*(\d{4})$/.exec(degree.school)?.[1] ?? ''
                const name = degree.school.replace(/,\s*\d{4}$/, '')
                return (
                  <article key={degree.title} className="pf-card pf-degree">
                    <GraduationCap size={22} className="pf-card-icon" aria-hidden="true" />
                    <div>
                      <h3>{degree.title}</h3>
                      <p>{name}{degreeYear && <span className="pf-date"> · {degreeYear}</span>}</p>
                      {degree.notes.map((note) => <p key={note} className="pf-muted">{note}</p>)}
                    </div>
                  </article>
                )
              })}
            </div>
            <ul className="pf-card pf-certs" aria-label="Certifications">
              {education.certifications.map((cert) => {
                const { name, year: certYear } = splitYear(cert)
                return <li key={cert}><Award size={18} className="pf-card-icon" aria-hidden="true" /><span>{name}</span>{certYear && <span className="pf-date">{certYear}</span>}</li>
              })}
            </ul>
          </div>
        </Section>

        <Section id="now" index={next()} title="Now" {...sectionProps}>
          <div className="pf-now">
            <div className="pf-card pf-now-list">
              <p className="pf-date">Updated {nowItems.updated}</p>
              <ul className="pf-bullets">{nowItems.items.map((item) => <li key={item}><Md inline>{item}</Md></li>)}</ul>
            </div>
            {live && <Heatmap />}
          </div>
        </Section>

        <Section id="guestbook" index={next()} title="Guestbook" {...sectionProps}>
          <Guestbook live={live} />
        </Section>

        <Section id="contact" index={next()} title="Contact" {...sectionProps}>
          <div className="pf-card pf-contact">
            <div>
              <h3>Let's build something reliable.</h3>
              <p className="pf-muted">Email is the fastest way to reach me.</p>
              <div className="pf-actions">
                <a className="pf-btn primary" href={`mailto:${profile.email}`}><Mail size={16} aria-hidden="true" /> {profile.email}</a>
                <a className="pf-btn" href={profile.resume} {...linkAttrs(profile.resume)}><FileText size={16} aria-hidden="true" /> Resume</a>
              </div>
            </div>
            <ul className="pf-contact-list">
              <li><GitHubIcon /><a href={profile.github} {...linkAttrs(profile.github)}>github.com/deepratna-awale</a></li>
              <li><LinkedInIcon /><a href={profile.linkedin} {...linkAttrs(profile.linkedin)}>linkedin.com/in/deepratna-awale</a></li>
              <li><Mail size={16} aria-hidden="true" /><a href={`mailto:${profile.email}`}>{profile.email}</a></li>
              <li><SquareTerminal size={16} aria-hidden="true" /><a href="/">Terminal version of this site</a></li>
            </ul>
          </div>
        </Section>
      </main>

      <footer className="pf-footer">
        <p>© {year} {profile.name}</p>
        <p><a href="/">Open the terminal</a> · <a href={profile.source} {...linkAttrs(profile.source)}>Source on GitHub</a></p>
      </footer>
    </div>
  )
}

export default Portfolio
