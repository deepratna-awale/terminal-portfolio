import { describe, expect, it } from 'vitest'
import { profile } from '../content'
import { DINO, HOME, NEWTAB, URLS, VERSION, pageTitle, resolveAddress } from './address'
import { parseEducation, parseExperience, parsePublications, parseSkills } from './parse'

describe('address bar', () => {
  const host = profile.host
  const origin = 'http://localhost:5179'
  it('keeps the portfolio and new tab inside the window', () => {
    expect(resolveAddress(`${host}/gui`, origin)).toEqual({ kind: 'page', url: HOME })
    expect(resolveAddress(`https://${host}/gui#projects`, origin)).toEqual({ kind: 'page', url: `${HOME}#projects` })
    expect(resolveAddress('/gui', origin)).toEqual({ kind: 'page', url: HOME })
    expect(resolveAddress('localhost:5179/gui/', origin)).toEqual({ kind: 'page', url: HOME })
    expect(resolveAddress('chrome://newtab', origin)).toEqual({ kind: 'page', url: NEWTAB })
  })
  it('sends the terminal home and everything else to a real tab', () => {
    expect(resolveAddress(host, origin)).toEqual({ kind: 'terminal' })
    expect(resolveAddress('/', origin)).toEqual({ kind: 'terminal' })
    expect(resolveAddress('github.com/octocat', origin)).toEqual({ kind: 'external', url: 'https://github.com/octocat' })
    expect(resolveAddress('http://example.com', origin)).toEqual({ kind: 'external', url: 'http://example.com' })
    expect(resolveAddress('/media/cv.pdf', origin)).toEqual({ kind: 'external', url: 'http://localhost:5179/media/cv.pdf' })
    expect(resolveAddress(`${host}/media/cv.pdf`, origin)).toEqual({ kind: 'external', url: `https://${host}/media/cv.pdf` })
    expect(resolveAddress('mailto:a@b.c', origin)).toEqual({ kind: 'mail', url: 'mailto:a@b.c' })
    expect(resolveAddress('agentic ai', origin)).toEqual({ kind: 'external', url: 'https://www.google.com/search?q=agentic%20ai' })
    expect(resolveAddress('   ', origin)).toBeNull()
  })

  it('opens chrome:// pages and search easter eggs in place', () => {
    expect(resolveAddress('chrome://dino', origin)).toEqual({ kind: 'page', url: DINO })
    expect(resolveAddress('chrome://version/', origin)).toEqual({ kind: 'page', url: VERSION })
    expect(resolveAddress('about:about', origin)).toEqual({ kind: 'page', url: URLS })
    expect(resolveAddress('chrome://nope', origin)).toEqual({ kind: 'page', url: URLS })
    expect(pageTitle(VERSION)).toBe('About Version')
    expect(resolveAddress('Do a barrel roll!', origin)).toEqual({ kind: 'egg', egg: 'roll' })
    expect(resolveAddress('askew', origin)).toEqual({ kind: 'egg', egg: 'askew' })
    expect(resolveAddress('flip a coin', origin)).toEqual({ kind: 'egg', egg: 'coin' })
    expect(resolveAddress('roll a die', origin)).toEqual({ kind: 'egg', egg: 'die' })
  })
})

// Sample sections in the ABOUT.md format, so these tests keep passing when a fork rewrites ABOUT.md.
const lines = (text: string) => text.split('\n')
const experience = lines(`## Senior Software Engineer
**Acme** (Widgets) [May 2026 to Present] | Halifax, NS

- Built the thing.
- Shipped the other thing.

## Software Engineer
**Initech Inc.** [August 2025 to May 2026] | Toronto, ON

- Fixed the printer.`)
const skills = lines(`**Backend**     Node  Postgres  Redis
**Cloud**       AWS  Terraform`)
const publications = lines(`## A Paper About Things
JOSS, 2021. What it found.
[arXiv](https://arxiv.org/abs/0000.00000)`)
const education = lines(`**MSc, Computer Science**  Some University, 2024
  Thesis: Graph search at scale.
**BSc, Computer Science**  Another College, 2021
  Project: [Answer grader](https://github.com/octocat/grader), automated scoring.

Certifications
  [Cloud Practitioner](https://example.com/a) (2025)
  [Data Science](https://example.com/b) (2019)`)

describe('content parsing', () => {
  it('turns terminal markdown into structured sections', () => {
    const { jobs, earlier } = parseExperience(experience)
    expect(jobs[0]).toMatchObject({ role: 'Senior Software Engineer', company: 'Acme (Widgets)', dates: 'May 2026 – Present' })
    expect(jobs[0]!.bullets.length).toBeGreaterThan(1)
    expect(jobs.map((job) => job.company)).toEqual(['Acme (Widgets)', 'Initech Inc.'])
    expect(earlier).toBeFalsy()
    expect(parseSkills(skills)[0]).toEqual({ category: 'Backend', items: ['Node', 'Postgres', 'Redis'] })
    expect(parsePublications(publications)[0]).toMatchObject({ title: 'A Paper About Things', venue: 'JOSS, 2021' })
    const parsed = parseEducation(education)
    expect(parsed.degrees).toHaveLength(2)
    expect(parsed.degrees[0]!.notes[0]).toMatch(/^Thesis: Graph search/)
    expect(parsed.degrees[1]!.notes[0]).toMatch(/Answer grader/)
    expect(parsed.certifications).toHaveLength(2)
  })
})
