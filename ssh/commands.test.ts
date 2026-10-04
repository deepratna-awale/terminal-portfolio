// Runs every command the way an SSH visitor would, so a browser-only change to
// the shared shell (window, document, localStorage ...) fails here, not in production.
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { aliases, commands } from '../src/shell/commands'
import { stripAnsi } from './ansi'
import { Session } from './session'

const day = (offset: number) => new Date(Date.now() - offset * 86_400_000).toISOString().slice(0, 10)
const responses: Record<string, unknown> = {
  '/api/projects': [{ name: 'demo', description: 'A demo', language: 'TypeScript', stars: 3, url: 'https://github.com/example/demo', homepage: null, image: '/media/projects/demo.jpg', pushedAt: new Date().toISOString(), bullets: ['Does a thing'] }],
  '/api/contributions': { total: 42, days: Array.from({ length: 371 }, (_, index) => ({ date: day(370 - index), level: index % 5, count: index % 5 })) },
  '/api/activity': { repo: 'example/demo', url: 'https://github.com/example/demo', action: 'pushed to', at: new Date().toISOString() },
  '/api/guestbook': [{ name: 'Ada', message: 'Hello', at: new Date().toISOString() }],
  '/api/chat': { reply: 'An answer.' },
  '/api/fortune': 'You will write tests.',
  '/api/cowthink': '( moo )',
}

const nativeFetch = globalThis.fetch
beforeAll(() => {
  globalThis.fetch = vi.fn(async (input: string | URL | Request) => {
    const path = String(input).replace(/\?.*$/, '')
    const body = responses[path]
    if (body === undefined) return new Response('not found', { status: 404 })
    return new Response(typeof body === 'string' ? body : JSON.stringify(body), { status: 200 })
  }) as typeof fetch
})
afterAll(() => { globalThis.fetch = nativeFetch })

// Browser-only globals, and the crashes they cause in Node.
const crash = /is not defined|is not a function|Cannot read properties|ReferenceError|TypeError/

async function run(line: string, keys: string[] = []) {
  let output = ''
  const session = new Session({ ip: '198.51.100.1', columns: 100, rows: 40, term: 'xterm-256color', env: {}, probeMs: 10_000, io: { write: (data) => { output += data }, close: () => {} } })
  session.input('\x1b[?62;22c')
  output = ''
  session.input(`${line}\r`)
  for (let wait = 0; wait < 40 && !/% $/.test(stripAnsi(output).trimEnd() + ' '); wait++) await new Promise((resolve) => setTimeout(resolve, 25))
  for (const key of keys) session.input(key)
  session.close()
  return stripAnsi(output)
}

const interactive: Record<string, string[]> = { snake: ['q'], '2048': ['q'], matrix: ['x'], vim: [':q\r'], vi: [':q\r'], nvim: [':q\r'], nano: [':q\r'] }
// Commands whose bare form waits on purpose (meltdown animation, a prompt).
const skip = new Set(['exit', 'q'])

describe('every command over SSH', () => {
  const names = [...Object.keys(commands), ...Object.keys(aliases)].filter((name) => !skip.has(name))

  it.each(names)('%s', async (name) => {
    const output = await run(name, interactive[name])
    expect(output).not.toMatch(crash)
  })

  it.each([
    'now', 'contributions', 'projects', 'cat projects/demo', 'view architecture.svg', 'view screenshots/demo', 'theme dracula', 'open github', 'open demo',
    'resume', 'email', 'share help', 'fortune | cowthink', 'cat about | grep -i engineer', 'tree', 'ls projects', 'guestbook', 'what are you working on?', 'graphics blocks 256',
  ])('%s', async (line) => {
    const output = await run(line)
    expect(output).not.toMatch(crash)
  })

  it('sizes the contribution graph to the terminal', async () => {
    const output = await run('contributions')
    expect(output).toContain('42 contributions')
    expect(Math.max(...output.split('\n').filter((line) => /[░▒▓█·]/.test(line)).map((line) => line.length))).toBeLessThanOrEqual(100)
  })
})
