import { describe, expect, it } from 'vitest'
import { latestContribution } from './activity.mjs'
import { guardrailReason } from './bedrock.mjs'
import { parseContributions } from './contributions.mjs'
import { clean, validate } from './guestbook.mjs'
import { clientIp } from './rateLimit.mjs'
import { hostName, isPublicIpv4, lookupHost } from './resolve.mjs'
import { signRequest } from './s3.mjs'

describe('s3 signing', () => {
  it('matches the AWS SigV4 GetObject example', () => {
    const headers = signRequest({
      method: 'GET', host: 'examplebucket.s3.amazonaws.com', path: '/test.txt', region: 'us-east-1',
      accessKeyId: 'AKIAIOSFODNN7EXAMPLE', secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
      headers: { Range: 'bytes=0-9' }, now: new Date('2013-05-24T00:00:00Z'),
    })
    expect(headers.Authorization).toBe('AWS4-HMAC-SHA256 Credential=AKIAIOSFODNN7EXAMPLE/20130524/us-east-1/s3/aws4_request, SignedHeaders=host;range;x-amz-content-sha256;x-amz-date, Signature=f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41')
  })
})

describe('guestbook', () => {
  it('strips HTML, control and bidi characters', () => {
    expect(clean('hi‮ <b>there</b>\n\nfriend')).toBe('hi there friend')
  })

  it('validates entries', () => {
    expect(validate({ message: 'x' }).error).toBeTruthy()
    expect(validate({ message: 'a b '.repeat(80) }).error).toContain('280')
    expect(validate({ message: 'hello', website: 'bot' }).entry).toBeUndefined()
    expect(validate({ name: '', message: 'hello there' }).entry).toMatchObject({ name: 'guest', message: 'hello there' })
    expect(validate({ name: 'Zoë O\'Brien-Ng', message: 'Great site!' }).entry).toMatchObject({ name: 'Zoë O\'Brien-Ng' })
  })

  it('rejects personal details, links and spam', () => {
    expect(validate({ message: 'see https://spam.example' }).error).toMatch(/links/)
    expect(validate({ message: 'buy at cheap-pills.com' }).error).toMatch(/links/)
    expect(validate({ message: 'mail me at a.b@example.org' }).error).toMatch(/email/)
    expect(validate({ message: 'call +1 (709) 555-0199' }).error).toMatch(/phone/)
    expect(validate({ name: 'x'.repeat(40), message: 'hi there' }).error).toMatch(/name/)
    expect(validate({ name: '<b>Ada</b>', message: 'hi there' }).entry).toMatchObject({ name: 'Ada' })
    expect(validate({ name: 'Ada; DROP', message: 'hi there' }).error).toMatch(/names/)
    expect(validate({ message: 'woooooooooooooow' }).error).toMatch(/spam/)
    expect(validate({ message: 'Loved it, met you in 2025 at AWS Summit St. John\'s' }).entry).toBeTruthy()
  })
})

describe('contributions', () => {
  it('parses the calendar fragment', () => {
    const html = `<h2>1,234 contributions in the last year</h2>
      <td data-date="2026-01-02" id="day-1" data-level="2" class="x"></td><tool-tip for="day-1" class="sr-only">5 contributions on January 2nd.</tool-tip>
      <td data-date="2026-01-01" id="day-0" data-level="0"></td><tool-tip for="day-0">No contributions on January 1st.</tool-tip>`
    expect(parseContributions(html)).toEqual({ total: 1234, days: [{ date: '2026-01-01', level: 0, count: 0 }, { date: '2026-01-02', level: 2, count: 5 }] })
  })
})

describe('client keys', () => {
  it('groups IPv6 addresses by /64 and leaves IPv4 alone', async () => {
    const { clientKey } = await import('./rateLimit.mjs')
    expect(clientKey('203.0.113.7')).toBe('203.0.113.7')
    expect(clientKey('::ffff:203.0.113.7')).toBe('203.0.113.7')
    expect(clientKey('2001:db8:aa:1::1')).toBe('2001:db8:aa:1::/64')
    expect(clientKey('2001:0db8:00aa:0001:ffff:1:2:3')).toBe('2001:db8:aa:1::/64')
    expect(clientKey('2001:db8::5')).toBe('2001:db8:0:0::/64')
  })
})

describe('recent activity', () => {
  it('picks the latest contribution and skips noise', () => {
    const events = [
      { type: 'WatchEvent', repo: { name: 'someone/starred' }, created_at: '2026-10-04T12:00:00Z' },
      { type: 'PushEvent', repo: { name: 'deepratna-awale/terminal-portfolio' }, created_at: '2026-10-04T11:00:00Z' },
    ]
    expect(latestContribution(events)).toEqual({ repo: 'deepratna-awale/terminal-portfolio', url: 'https://github.com/deepratna-awale/terminal-portfolio', action: 'pushed to', at: '2026-10-04T11:00:00Z' })
    expect(latestContribution([])).toBeNull()
    expect(latestContribution({ message: 'rate limited' })).toBeNull()
  })
})

describe('client addresses', () => {
  const request = (forwarded) => ({ headers: { 'x-forwarded-for': forwarded }, socket: { remoteAddress: '10.0.0.1' } })
  const relays = new Set(['203.0.113.7'])

  it('takes the hop the load balancer added', () => {
    expect(clientIp(request('1.1.1.1, 198.51.100.2'), relays)).toBe('198.51.100.2')
    expect(clientIp(request(undefined), relays)).toBe('10.0.0.1')
  })

  it('trusts the forwarded visitor only from a relay', () => {
    expect(clientIp(request('198.51.100.9, 203.0.113.7'), relays)).toBe('198.51.100.9')
    expect(clientIp(request('203.0.113.7'), relays)).toBe('203.0.113.7')
    expect(clientIp(request('198.51.100.9, 192.0.2.1'), relays)).toBe('192.0.2.1')
  })
})

describe('guardrail reasons', () => {
  it('names a broad category without the rule', () => {
    expect(guardrailReason([{ wordPolicy: { managedWordLists: [{ type: 'PROFANITY', match: 'x', action: 'BLOCKED', detected: true }] } }])).toBe('it contains profanity')
    expect(guardrailReason([{ contentPolicy: { filters: [{ type: 'PROMPT_ATTACK', action: 'BLOCKED', detected: true }] } }])).toMatch(/instructions/)
    expect(guardrailReason([{ sensitiveInformationPolicy: { piiEntities: [{ type: 'CREDIT_DEBIT_CARD_NUMBER', action: 'BLOCKED', detected: true }], regexes: [] } }])).toMatch(/personal/)
    expect(guardrailReason([{ contentPolicy: { filters: [{ type: 'INSULTS', detected: true }] }, wordPolicy: { managedWordLists: [{ type: 'PROFANITY', detected: true }] } }])).toBe('it contains profanity')
    expect(guardrailReason([])).toMatch(/rules/)
  })
})

describe('guestbook delete keys', () => {
  it('lets only the author delete a note, and clears notes without a key', async () => {
    const { mkdtemp, readFile, writeFile } = await import('node:fs/promises')
    const { tmpdir } = await import('node:os')
    const { join } = await import('node:path')
    const file = join(await mkdtemp(join(tmpdir(), 'guestbook-')), 'guestbook.json')
    await writeFile(file, JSON.stringify([{ name: 'old', message: 'from before keys', at: '2026-01-01T00:00:00.000Z' }]))
    process.env.GUESTBOOK_FILE = file
    const { addEntry, deleteEntry, listEntries } = await import('./guestbook.mjs?keys')
    expect(await listEntries()).toEqual([])
    expect(JSON.parse(await readFile(file, 'utf8'))).toEqual([])

    const signed = await addEntry({ name: 'Ada', message: 'hello there', at: '2026-10-04T00:00:00.000Z' })
    expect(signed.key).toMatch(/^[0-9a-f]{12}\.[\w-]{32}$/)
    const [listed] = await listEntries()
    expect(listed).toEqual({ id: signed.id, name: 'Ada', message: 'hello there', at: '2026-10-04T00:00:00.000Z' })
    expect(await readFile(file, 'utf8')).not.toContain(signed.key.split('.')[1])

    const other = await addEntry({ name: 'Bob', message: 'hi again', at: '2026-10-04T00:00:01.000Z' })
    expect(await deleteEntry(`${signed.id}.${other.key.split('.')[1]}`)).toBe(false)
    expect(await deleteEntry('nonsense')).toBe(false)
    expect(await deleteEntry(signed.key)).toBe(true)
    expect(await deleteEntry(signed.key)).toBe(false)
    expect((await listEntries()).map((entry) => entry.name)).toEqual(['Bob'])
  })
})

describe('assistant prompt', () => {
  it('describes the current site from ABOUT.md, even before GitHub answers', async () => {
    const { about, featured, profile } = await import('./about.mjs')
    const { systemPrompt } = await import('./prompt.mjs')
    const prompt = systemPrompt()
    for (const name of featured) expect(prompt).toContain(`- ${name}: `)
    if (about.meta.ssh) expect(prompt).toContain(`ssh ${about.meta.ssh}`)
    expect(prompt).toContain('guestbook delete')
    if (profile.resume) expect(prompt).toContain(profile.resume)
    expect(prompt).not.toContain('still loading')
  })
})

describe('resolve', () => {
  it('accepts hosts and URLs only', () => {
    expect(hostName('https://Example.com/x')).toBe('example.com')
    expect(hostName('a.b')).toBe('a.b')
    expect(hostName('localhost')).toBeNull()
    expect(hostName('1.2.3.4')).toBeNull()
    expect(hostName('bad_host.com')).toBeNull()
    expect(hostName('x'.repeat(300) + '.com')).toBeNull()
  })

  it('shows public IPv4 addresses only', async () => {
    for (const ip of ['10.0.0.1', '127.0.0.1', '169.254.169.254', '172.20.1.1', '192.168.1.1', '100.64.0.1', '0.0.0.0', '224.0.0.1']) expect(isPublicIpv4(ip)).toBe(false)
    expect(isPublicIpv4('93.184.215.14')).toBe(true)
    expect(await lookupHost('example.com', async () => ['10.0.0.5', '93.184.215.14'])).toEqual({ host: 'example.com', ip: '93.184.215.14' })
    expect(await lookupHost('internal.example', async () => ['10.0.0.5'])).toBeNull()
    expect(await lookupHost('gone.example', async () => { throw new Error('ENOTFOUND') })).toBeNull()
  })
})
