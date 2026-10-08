import { describe, expect, it } from 'vitest'
import { initialCommand } from './deeplink'
import { profile, sshHost } from '../content'
import { fakeIp, hackTarget, isOwnTarget, isRootWipe, parseSign, readFile, sshHint } from './commands'
import { renderHeatmap } from './heatmap'
import { filters, grepLines, toPlainText } from './pipes'
import { closest, looksLikeCommand } from './typo'

describe('typo suggestions', () => {
  it('finds close commands', () => {
    expect(closest('porjects', ['projects', 'about'])).toBe('projects')
    expect(closest('sl', ['ls'])).toBe('ls')
    expect(closest('abuot', ['about'])).toBe('about')
    expect(closest('banana', ['about', 'projects'])).toBeUndefined()
  })

  it('leaves questions for the assistant', () => {
    expect(looksLikeCommand('cta about')).toBe(true)
    expect(looksLikeCommand('what does deep do at nasdaq?')).toBe(false)
    expect(looksLikeCommand('who are you')).toBe(true)
  })
})

describe('ssh hint', () => {
  it.skipIf(!sshHost)('offers the SSH command from ABOUT.md as a copy link', () => {
    const [line] = sshHint()
    expect(line?.text).toContain(`[\`ssh ${sshHost}\`](copy:ssh%20${sshHost})`)
    expect(toPlainText(line!.text)).toContain(`ssh ${sshHost} (click to copy)`)
  })
})

describe('pipes', () => {
  it('flattens markdown', () => {
    expect(toPlainText('## Title\n**bold** [`help`](cmd:help) `code`\n- item')).toBe('Title\nbold help code\n• item')
  })

  it('filters lines', () => {
    expect(grepLines(['AWS Lambda', 'React', 'aws cdk'], ['-i', 'aws'])).toEqual(['AWS Lambda', 'aws cdk'])
    expect(grepLines(['a', 'b'], ['-v', 'a'])).toEqual(['b'])
    expect(filters.head!(['1', '2', '3'], ['-n', '2'])).toEqual(['1', '2'])
    expect(filters.wc!(['one two', 'three'], ['-l'])).toEqual(['2'])
    expect(filters.sort!(['b', 'a'], [])).toEqual(['a', 'b'])
  })
})

describe('filesystem', () => {
  it('reads files from anywhere', () => {
    expect(readFile('about')?.name).toBe('about.md')
    expect(readFile('skills/skills.md')?.text).toContain('Python')
    expect(readFile('resume.pdf')?.text).toContain('Experience')
    expect(readFile('nope')).toBeUndefined()
  })

  it('recognises rm -rf /', () => {
    expect(isRootWipe(['-rf', '/'])).toBe(true)
    expect(isRootWipe(['-fr', '--no-preserve-root', '/'])).toBe(true)
    expect(isRootWipe(['about.md'])).toBe(false)
  })
})

describe('deep links', () => {
  it('reads ?cmd= and paths', () => {
    expect(initialCommand({ search: '?cmd=projects', pathname: '/' })).toBe('projects')
    expect(initialCommand({ search: '', pathname: '/experience' })).toBe('experience')
    expect(initialCommand({ search: '', pathname: '/projects/sd-parsers' })).toBe('cat projects/sd-parsers')
    expect(initialCommand({ search: '', pathname: '/gui' })).toBeNull()
    expect(initialCommand({ search: '', pathname: '/rm' })).toBeNull()
  })

  it('never replays commands with side effects from the URL', () => {
    expect(initialCommand({ search: '?cmd=open%20open-wallpaper-engine-mac', pathname: '/' })).toBeNull()
    expect(initialCommand({ search: '?cmd=resume', pathname: '/' })).toBeNull()
    expect(initialCommand({ search: '?cmd=projects%20%26%26%20email', pathname: '/' })).toBeNull()
    expect(initialCommand({ search: '?cmd=matrix', pathname: '/' })).toBeNull()
    expect(initialCommand({ search: '', pathname: '/open' })).toBeNull()
    expect(initialCommand({ search: '?cmd=cat%20about.md', pathname: '/' })).toBe('cat about.md')
  })
})

describe('heatmap', () => {
  it('lays out weeks as columns starting on Sunday', () => {
    const days = Array.from({ length: 14 }, (_, index) => ({ date: `2026-03-${String(index + 1).padStart(2, '0')}`, level: index % 5, count: index }))
    const rows = renderHeatmap(days).split('\n')
    expect(rows).toHaveLength(8)
    expect(rows[0]).toContain('Mar')
    expect(rows[1]).toBe('    ·▒')
  })
})

describe('guestbook sign', () => {
  it('reads the name flag in any position', () => {
    expect(parseSign(['--name', 'Jane Doe', 'great', 'site'])).toEqual({ name: 'Jane Doe', message: 'great site' })
    expect(parseSign(['great', 'site', '-n', 'Ada'])).toEqual({ name: 'Ada', message: 'great site' })
    expect(parseSign(['--name=Ada'])).toEqual({ name: 'Ada', message: '' })
    expect(parseSign([])).toEqual({ name: '', message: '' })
  })
})

describe('hack', () => {
  it('takes a host or URL and rejects junk', () => {
    expect(hackTarget('https://User@Example.com:8443/path?q=1')).toBe('example.com')
    expect(hackTarget('example.com.')).toBe('example.com')
    expect(hackTarget('8.8.8.8')).toBe('8.8.8.8')
    expect(hackTarget('localhost')).toBeNull()
    expect(hackTarget('not a site')).toBeNull()
  })

  it('refuses to hack the owner', () => {
    for (const target of [profile.host, `https://www.${profile.host}/gui`, `ssh.${profile.host}`, `github.com/${profile.handle}`, 'localhost', '127.0.0.1:8787']) expect(isOwnTarget(target)).toBe(true)
    if (sshHost) expect(isOwnTarget(sshHost)).toBe(true)
    for (const target of ['github.com', 'example.com', '8.8.8.8']) expect(isOwnTarget(target)).toBe(false)
  })

  it('makes up a stable public-looking address', () => {
    expect(fakeIp('example.com')).toBe(fakeIp('example.com'))
    expect(fakeIp('example.com')).toMatch(/^(23|45|52|104|142|151|185)\.\d{1,3}\.\d{1,3}\.\d{1,3}$/)
  })
})
