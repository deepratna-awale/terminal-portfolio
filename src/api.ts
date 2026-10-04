export type Project = {
  name: string
  description: string
  language: string | null
  stars: number
  url: string
  homepage: string | null
  pushedAt: string
  bullets: string[]
}

export type ChatTurn = { role: 'user' | 'assistant'; content: string }

async function textOrThrow(response: Response): Promise<string> {
  const body = await response.text()
  if (!response.ok) throw new Error(body || `request failed (${response.status})`)
  return body
}

let projectsPromise: Promise<Project[]> | null = null

export function fetchProjects(): Promise<Project[]> {
  projectsPromise ??= fetch('/api/projects')
    .then(async (response) => JSON.parse(await textOrThrow(response)) as Project[])
    .catch((error: unknown) => { projectsPromise = null; throw error })
  return projectsPromise
}

export async function fetchFortune(): Promise<string> {
  return textOrThrow(await fetch('/api/fortune'))
}

export async function fetchCowthink(text: string): Promise<string> {
  return textOrThrow(await fetch(`/api/cowthink?text=${encodeURIComponent(text)}`))
}

export async function askAssistant(messages: ChatTurn[], signal?: AbortSignal): Promise<string> {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages }),
    signal,
  })
  const body = await response.text()
  if (!response.ok) {
    let message = body
    try { message = (JSON.parse(body) as { error?: string }).error ?? body } catch { /* plain text error */ }
    throw new Error(message || 'the assistant is unavailable right now')
  }
  return (JSON.parse(body) as { reply: string }).reply
}
