export type Project = {
  name: string
  description: string
  language: string | null
  stars: number
  url: string
  homepage: string | null
  image: string | null
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

export type GuestbookEntry = { name: string; message: string; at: string }
export type Contributions = { total: number; days: Array<{ date: string; level: number; count: number }> }

async function jsonOrThrow<T>(response: Response): Promise<T> {
  const body = await response.text()
  let parsed: unknown
  try { parsed = JSON.parse(body) } catch { parsed = undefined }
  if (!response.ok) throw new Error((parsed as { error?: string } | undefined)?.error ?? (body || `request failed (${response.status})`))
  return parsed as T
}

export async function fetchContributions(): Promise<Contributions> {
  return jsonOrThrow<Contributions>(await fetch('/api/contributions'))
}

export async function fetchGuestbook(): Promise<GuestbookEntry[]> {
  return jsonOrThrow<GuestbookEntry[]>(await fetch('/api/guestbook'))
}

export async function signGuestbook(name: string, message: string): Promise<GuestbookEntry> {
  return jsonOrThrow<GuestbookEntry>(await fetch('/api/guestbook', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, message }) }))
}

export type Activity = { repo?: string; url?: string; action?: string; at?: string }

export async function fetchActivity(): Promise<Activity> {
  return jsonOrThrow<Activity>(await fetch('/api/activity'))
}
