import { describe, expect, it } from 'vitest'
import { sections } from '../content'
import { DINO, HOME, NEWTAB, URLS, VERSION, pageTitle, resolveAddress } from './address'
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

describe('content parsing', () => {
  it('turns terminal markdown into structured sections', () => {
    const { jobs, earlier } = parseExperience(sections.experience!)
    expect(jobs[0]).toMatchObject({ role: 'Senior Software Engineer', company: 'Nasdaq (Verafin)', dates: 'May 2026 – Present' })
    expect(jobs[0]!.bullets.length).toBeGreaterThan(1)
    expect(jobs.map((job) => job.company)).toEqual(['Nasdaq (Verafin)', 'Innodata Inc.'])
    expect(earlier).toBeFalsy()
    expect(parseSkills(sections.skills!)[0]).toEqual({ category: 'Agentic AI', items: ['Bedrock AgentCore', 'LangChain', 'prompt engineering', 'evals', 'RAG'] })
    expect(parsePublications(sections.publications!)[0]).toMatchObject({ title: 'Semantic Analysis of Long Answers', venue: 'IRJCS, 2021' })
    const education = parseEducation(sections.education!)
    expect(education.degrees).toHaveLength(2)
    expect(education.degrees[0]!.notes[0]).toMatch(/^Capstone Project: Hybrid/)
    expect(education.degrees[1]!.notes[0]).toMatch(/TAES2/)
    expect(education.certifications).toHaveLength(3)
  })
})
