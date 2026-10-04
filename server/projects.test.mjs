import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { featured } from './about.mjs'

function repo(name, description) {
  return { name, private: false, description, default_branch: 'main', pushed_at: '2026-10-01T00:00:00Z', html_url: `https://github.com/x/${name}`, stargazers_count: 1 }
}

describe('featured projects', () => {
  const calls = []

  beforeAll(() => {
    vi.stubGlobal('fetch', vi.fn(async (url) => {
      calls.push(String(url))
      return new Response(JSON.stringify([repo('unlisted', 'Not featured.'), ...featured.map((name) => repo(name, 'One sentence. Two sentences.'))]), { status: 200 })
    }))
  })

  afterAll(() => vi.unstubAllGlobals())

  it('uses the bullets from ABOUT.md, in order, without calling a model', async () => {
    const { getProjects } = await import('./projects.mjs')
    const projects = await getProjects()
    expect(projects.map((project) => project.name)).toEqual(featured)
    for (const project of projects) expect(project.bullets.length).toBeGreaterThanOrEqual(2)
    expect(projects[0].bullets[0]).not.toBe('One sentence.')
    expect(calls.every((url) => url.startsWith('https://api.github.com/'))).toBe(true)
  })
})
