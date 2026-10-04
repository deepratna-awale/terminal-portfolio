import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

const DAY = 24 * 60 * 60 * 1000
let bedrockCalls = 0
let saved = null

async function fakeFetch(url, init = {}) {
  const href = String(url)
  const json = (body) => new Response(JSON.stringify(body), { status: 200 })
  if (href.startsWith('https://api.github.com/users/')) {
    return json([{ name: 'sd-parsers', private: false, description: 'Parses things.', default_branch: 'main', pushed_at: new Date().toISOString(), html_url: 'https://github.com/x/sd-parsers', stargazers_count: 1 }])
  }
  if (href.startsWith('https://raw.githubusercontent.com/')) return new Response('# sd-parsers\nReads metadata.', { status: 200 })
  if (href.includes('bedrock-runtime')) {
    bedrockCalls++
    return json({ output: { message: { content: [{ text: '["Reads image metadata.", "Supports many tools."]' }] } }, stopReason: 'end_turn' })
  }
  if (href.includes('project-summaries.json')) {
    if (init.method === 'PUT') { saved = init.body; return new Response('', { status: 200 }) }
    return saved ? new Response(saved, { status: 200 }) : new Response('', { status: 404 })
  }
  return new Response('', { status: 404 })
}

describe('project summaries', () => {
  beforeAll(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.stubGlobal('fetch', vi.fn(fakeFetch))
    vi.stubEnv('AWS_BEARER_TOKEN_BEDROCK', 'token')
    vi.stubEnv('BEDROCK_GUARDRAIL_ID', 'guardrail')
    vi.stubEnv('BEDROCK_GUARDRAIL_VERSION', '1')
    vi.stubEnv('GUESTBOOK_BUCKET', 'bucket')
    vi.stubEnv('GUESTBOOK_ACCESS_KEY_ID', 'key')
    vi.stubEnv('GUESTBOOK_SECRET_ACCESS_KEY', 'secret')
  })

  afterAll(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('reuses a saved summary for a month, across restarts', async () => {
    const first = await import('./projects.mjs')
    expect((await first.getProjects())[0].bullets).toEqual(['Reads image metadata.', 'Supports many tools.'])
    expect(bedrockCalls).toBe(1)
    expect(JSON.parse(saved)['sd-parsers'].bullets).toHaveLength(2)

    // A redeploy starts with an empty memory but finds the saved summary.
    vi.resetModules()
    vi.setSystemTime(Date.now() + 7 * DAY)
    const restarted = await import('./projects.mjs')
    expect((await restarted.getProjects())[0].bullets).toHaveLength(2)
    expect(bedrockCalls).toBe(1)

    vi.resetModules()
    vi.setSystemTime(Date.now() + 24 * DAY)
    await (await import('./projects.mjs')).getProjects()
    expect(bedrockCalls).toBe(2)
  })
})
