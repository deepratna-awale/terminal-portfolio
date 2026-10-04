import { describe, expect, it } from 'vitest'
import { parseContributions } from './contributions.mjs'
import { clean, validate } from './guestbook.mjs'
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
