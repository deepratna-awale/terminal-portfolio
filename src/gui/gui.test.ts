import { describe, expect, it } from 'vitest'
import { sections } from '../content'
import { HOME, NEWTAB, resolveAddress } from './address'
import { parseEducation, parseExperience, parsePublications, parseSkills } from './parse'

describe('address bar', () => {
  const origin = 'http://localhost:5179'
  it('keeps the portfolio and new tab inside the window', () => {
    expect(resolveAddress('deepratna-awale.dev/gui', origin)).toEqual({ kind: 'page', url: HOME })
    expect(resolveAddress('https://deepratna-awale.dev/gui#projects', origin)).toEqual({ kind: 'page', url: `${HOME}#projects` })
    expect(resolveAddress('/gui', origin)).toEqual({ kind: 'page', url: HOME })
    expect(resolveAddress('localhost:5179/gui/', origin)).toEqual({ kind: 'page', url: HOME })
    expect(resolveAddress('chrome://newtab', origin)).toEqual({ kind: 'page', url: NEWTAB })
  })
  it('sends the terminal home and everything else to a real tab', () => {
    expect(resolveAddress('deepratna-awale.dev', origin)).toEqual({ kind: 'terminal' })
    expect(resolveAddress('/', origin)).toEqual({ kind: 'terminal' })
    expect(resolveAddress('github.com/deepratna-awale', origin)).toEqual({ kind: 'external', url: 'https://github.com/deepratna-awale' })
    expect(resolveAddress('http://example.com', origin)).toEqual({ kind: 'external', url: 'http://example.com' })
    expect(resolveAddress('/media/cv.pdf', origin)).toEqual({ kind: 'external', url: 'http://localhost:5179/media/cv.pdf' })
    expect(resolveAddress('deepratna-awale.dev/media/cv.pdf', origin)).toEqual({ kind: 'external', url: 'https://deepratna-awale.dev/media/cv.pdf' })
    expect(resolveAddress('mailto:a@b.c', origin)).toEqual({ kind: 'mail', url: 'mailto:a@b.c' })
    expect(resolveAddress('agentic ai', origin)).toEqual({ kind: 'external', url: 'https://www.google.com/search?q=agentic%20ai' })
    expect(resolveAddress('   ', origin)).toBeNull()
  })
})

describe('content parsing', () => {
  it('turns terminal markdown into structured sections', () => {
    const { jobs, earlier } = parseExperience(sections.experience!)
    expect(jobs[0]).toMatchObject({ role: 'Senior Software Engineer', company: 'Nasdaq (Verafin)', dates: 'May 2026 – Present' })
    expect(jobs[0]!.bullets.length).toBeGreaterThan(1)
    expect(earlier).toMatch(/IIT Bombay/)
    expect(parseSkills(sections.skills!)[0]).toEqual({ category: 'Agentic AI', items: ['Bedrock AgentCore', 'LangChain', 'prompt engineering', 'evals', 'RAG'] })
    expect(parsePublications(sections.publications!)[0]).toMatchObject({ title: 'Semantic Analysis of Long Answers', venue: 'IRJCS, 2021' })
    const education = parseEducation(sections.education!)
    expect(education.degrees).toHaveLength(2)
    expect(education.degrees[0]!.notes[0]).toMatch(/Thesis/)
    expect(education.certifications).toHaveLength(3)
  })
})
