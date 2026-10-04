import type { ReactNode } from 'react'
import ReactMarkdown, { defaultUrlTransform } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Project } from '../api'
import { profile, sectionList, sections } from '../content'
import { TechIcon } from './TechIcon'
import './output.css'

// Rich terminal layouts for the known sections. The markdown in ABOUT.md
// stays the single source (the GUI site and the assistant read it too); this
// only parses its simple structure into boxes, timelines and chips. Any other
// section is rendered as plain markdown in a box.

type LinkRenderer = (props: { href?: string; children?: ReactNode }) => ReactNode
type Props = { name: string; renderLink: LinkRenderer }

const Inline = ({ text, renderLink }: { text: string; renderLink: LinkRenderer }) => (
  <ReactMarkdown urlTransform={(url) => (url.startsWith('cmd:') ? url : defaultUrlTransform(url))} components={{ a: renderLink, p: ({ children }) => <>{children}</> }}>{text}</ReactMarkdown>
)

function Box({ title, icon, children, className = '' }: { title: string; icon: string; children: ReactNode; className?: string }) {
  return (
    <section className={`tbox ${className}`}>
      <header className="tbox-title"><span className="tbox-icon" aria-hidden="true">{icon}</span>{title}</header>
      <div className="tbox-body">{children}</div>
    </section>
  )
}

function blocks(lines: string[], heading = /^## /) {
  const result: string[][] = []
  for (const line of lines) {
    if (heading.test(line) || !result.length) result.push([])
    result.at(-1)!.push(line)
  }
  return result
}

function About({ renderLink }: { renderLink: LinkRenderer }) {
  const lines = sections.about!
  const paragraphs = lines.slice(1).join('\n').split(/\n\s*\n/).map((part) => part.trim()).filter(Boolean)
  const facts = paragraphs.filter((part) => /^\*\*(Certification|Education):\*\*/.test(part)).flatMap((part) => part.split('\n'))
  const prose = paragraphs.filter((part) => !facts.length || !/^\*\*(Certification|Education):\*\*/.test(part))
  return (
    <Box title="about" icon="◉" className="tbox-about">
      <div className="about-head">
        <div className="about-avatar" aria-hidden="true">{profile.initials}</div>
        <div>
          <div className="about-name">{profile.name}</div>
          <div className="about-title">{profile.title}</div>
          <div className="about-meta">⌖ {profile.location}</div>
        </div>
      </div>
      {prose.map((part) => <p key={part} className="about-text"><Inline text={part} renderLink={renderLink} /></p>)}
      {facts.length > 0 && <dl className="kv">{facts.map((fact) => {
        const [, key = '', value = ''] = /^\*\*(.+?):\*\*\s*(.*)$/.exec(fact) ?? []
        return <div key={fact}><dt>{key}</dt><dd><Inline text={value} renderLink={renderLink} /></dd></div>
      })}</dl>}
    </Box>
  )
}

function Experience({ renderLink }: { renderLink: LinkRenderer }) {
  const roles = blocks(sections.experience!).filter((block) => block[0]?.startsWith('## '))
  const footer = sections.experience!.filter((line) => line.startsWith('Earlier:'))
  return (
    <Box title="experience" icon="⌘" className="tbox-timeline">
      <ol className="timeline">
        {roles.map((block, index) => {
          const title = block[0]!.replace(/^## /, '')
          const meta = block[1] ?? ''
          const [, name = meta, suffix = '', dates = '', place = ''] = /^\*\*(.+?)\*\*\s*([^[]*?)\s*\[(.+?)\]\s*\|?\s*(.*)$/.exec(meta) ?? []
          const company = suffix ? `${name} ${suffix}` : name
          const extra = block.slice(2).filter((line) => line && !line.startsWith('- ') && !line.startsWith('Earlier:'))
          const bullets = block.filter((line) => line.startsWith('- ')).map((line) => line.slice(2))
          return (
            <li key={title + company} className={index === 0 ? 'current' : ''}>
              <div className="role-head">
                <span className="role-title">{title}</span>
                <span className="role-dates">{dates.replace(' to ', ' → ')}</span>
              </div>
              <div className="role-company">{company}{place && <span className="role-place"> · {place}</span>}</div>
              {extra.map((line) => <div key={line} className="role-extra"><Inline text={line} renderLink={renderLink} /></div>)}
              <ul className="role-bullets">{bullets.map((bullet) => <li key={bullet}><Inline text={bullet} renderLink={renderLink} /></li>)}</ul>
            </li>
          )
        })}
      </ol>
      {footer.map((line) => <p key={line} className="tbox-note">{line}</p>)}
    </Box>
  )
}

function Skills() {
  const rows = sections.skills!.map((line) => /^\*\*(.+?)\*\*\s+(.*)$/.exec(line)).filter(Boolean) as RegExpExecArray[]
  return (
    <Box title="skills" icon="⚙" className="tbox-skills">
      <div className="skill-grid">
        {rows.map(([, category = '', items = '']) => (
          <div key={category} className="skill-row">
            <div className="skill-cat">{category.trim()}</div>
            <div className="chips">{items.split(/\s{2,}/).filter(Boolean).map((item) => <span key={item} className="chip"><TechIcon name={item} />{item}</span>)}</div>
          </div>
        ))}
      </div>
    </Box>
  )
}

function Publications({ renderLink }: { renderLink: LinkRenderer }) {
  const papers = blocks(sections.publications!).filter((block) => block[0]?.startsWith('## '))
  return (
    <Box title="publications" icon="✎" className="tbox-papers">
      {papers.map((block) => {
        const [venue = '', ...summary] = (block[1] ?? '').split('. ')
        return (
          <article key={block[0]} className="paper">
            <div className="paper-title">{block[0]!.replace(/^## /, '')}</div>
            <div className="paper-venue">{venue}</div>
            <p className="paper-summary">{summary.join('. ')}</p>
            <div className="paper-links">{block.slice(2).filter(Boolean).map((line) => <Inline key={line} text={line} renderLink={renderLink} />)}</div>
          </article>
        )
      })}
    </Box>
  )
}

function Education({ renderLink }: { renderLink: LinkRenderer }) {
  const lines = sections.education!
  const split = lines.indexOf('Certifications')
  const degrees = blocks(lines.slice(0, split), /^\*\*/).filter((block) => block[0])
  const certs = lines.slice(split + 1).map((line) => line.trim()).filter(Boolean)
  return (
    <Box title="education" icon="◆" className="tbox-education">
      {degrees.map((block) => {
        const [, degree = '', school = ''] = /^\*\*(.+?)\*\*\s+(.*)$/.exec(block[0]!) ?? []
        const [, place = school, year = ''] = /^(.*?),?\s+(\d{4})$/.exec(school) ?? []
        return (
          <div key={degree} className="degree">
            <div className="role-head"><span className="role-title">{degree}</span><span className="role-dates">{year}</span></div>
            <div className="role-company">{place}</div>
            {block.slice(1).filter((line) => line.trim()).map((line) => <div key={line} className="role-extra"><Inline text={line.trim()} renderLink={renderLink} /></div>)}
          </div>
        )
      })}
      <div className="cert-head">Certifications</div>
      <ul className="certs">{certs.map((cert) => {
        const [, name = cert, year = ''] = /^(.*?)\s*\((\d{4})\)$/.exec(cert) ?? []
        return <li key={cert}><span className="cert-badge" aria-hidden="true">✓</span><Inline text={name} renderLink={renderLink} />{year && <span className="role-dates"> {year}</span>}</li>
      })}</ul>
    </Box>
  )
}

const contactIcons: Record<string, string> = { email: '✉', linkedin: 'in', github: 'gh', web: '⌂', ssh: '>_' }

function Contact({ renderLink }: { renderLink: LinkRenderer }) {
  const rows = sections.contact!.map((line) => /^(\w+)\s{2,}(.*)$/.exec(line)).filter(Boolean) as RegExpExecArray[]
  const notes = sections.contact!.filter((line) => line && !/^(\w+)\s{2,}/.test(line))
  return (
    <Box title="contact" icon="✉" className="tbox-contact">
      <dl className="kv contact-kv">{rows.map(([, key = '', value = '']) => (
        <div key={key}><dt><span className={`contact-icon ${key}`} aria-hidden="true">{contactIcons[key] ?? '•'}</span>{key}</dt><dd><Inline text={value} renderLink={renderLink} /></dd></div>
      ))}</dl>
      {notes.map((line) => <p key={line} className="tbox-note"><Inline text={line} renderLink={renderLink} /></p>)}
    </Box>
  )
}

const languageColors: Record<string, string> = { Python: '#3572A5', TypeScript: '#3178c6', JavaScript: '#f1e05a', Java: '#b07219', 'C++': '#f34b7d', C: '#555555', Swift: '#F05138', Go: '#00ADD8', Rust: '#dea584', HTML: '#e34c26', CSS: '#563d7c', Shell: '#89e051', 'Jupyter Notebook': '#DA5B0B', HCL: '#844FBA', Kotlin: '#A97BFF', Dart: '#00B4AB' }

export function ProjectCards({ projects, detailed = false, renderLink }: { projects: Project[]; detailed?: boolean; renderLink: LinkRenderer }) {
  return (
    <div className={`project-grid${detailed ? ' detailed' : ''}`}>
      {projects.map((project) => (
        <article key={project.name} className="project-card">
          {project.image && <a className="project-thumb" href={project.url} target="_blank" rel="noopener noreferrer" tabIndex={-1} aria-hidden="true"><img src={project.image} alt="" width={1280} height={640} loading="lazy" decoding="async" /></a>}
          <header className="project-head">
            <span className="project-name">{renderLink({ href: `cmd:${encodeURIComponent(`cat projects/${project.name}`)}`, children: project.name })}</span>
            {project.stars > 0 && <span className="project-stars">★ {project.stars}</span>}
          </header>
          <ul className="role-bullets">{(project.bullets.length ? project.bullets : [project.description || 'No description yet.']).map((bullet) => <li key={bullet}>{bullet}</li>)}</ul>
          <footer className="project-foot">
            {project.language && <span className="project-lang"><span className="lang-dot" style={{ background: languageColors[project.language] ?? 'var(--accent-2)' }} />{project.language}</span>}
            {detailed && <span className="project-pushed">pushed {new Date(project.pushedAt).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}</span>}
            <span className="project-links">
              {renderLink({ href: project.url, children: 'github' })}
              {project.homepage && renderLink({ href: project.homepage, children: 'live' })}
              {renderLink({ href: `cmd:${encodeURIComponent(`view screenshots/${project.name}`)}`, children: 'preview' })}
            </span>
          </footer>
        </article>
      ))}
    </div>
  )
}

export function SectionView({ name, renderLink }: Props) {
  if (name === 'about') return <About renderLink={renderLink} />
  if (name === 'experience') return <Experience renderLink={renderLink} />
  if (name === 'skills') return <Skills />
  if (name === 'publications') return <Publications renderLink={renderLink} />
  if (name === 'education') return <Education renderLink={renderLink} />
  if (name === 'contact') return <Contact renderLink={renderLink} />
  const generic = sectionList.find((section) => section.id === name)
  if (!generic) return null
  return (
    <Box title={generic.id} icon="§" className="tbox-generic">
      <ReactMarkdown remarkPlugins={[remarkGfm]} urlTransform={(url) => (url.startsWith('cmd:') ? url : defaultUrlTransform(url))} components={{ a: renderLink }}>{generic.lines.join('\n')}</ReactMarkdown>
    </Box>
  )
}
