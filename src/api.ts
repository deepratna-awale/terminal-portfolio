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

// A blocked reply is the Guardrail's canned message; keep it out of the history
// so it doesn't colour the next question.
export async function askAssistant(messages: ChatTurn[], signal?: AbortSignal): Promise<{ reply: string; blocked: boolean }> {
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
  const { reply, blocked } = JSON.parse(body) as { reply: string; blocked?: boolean }
  return { reply, blocked: Boolean(blocked) }
}

export type GuestbookEntry = { id?: string; name: string; message: string; at: string }
// A new note comes back with its delete key, which the server never shows again.
export type SignedEntry = GuestbookEntry & { key: string }
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

export async function signGuestbook(name: string, message: string): Promise<SignedEntry> {
  return jsonOrThrow<SignedEntry>(await fetch('/api/guestbook', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, message }) }))
}

export async function deleteGuestbookNote(key: string): Promise<void> {
  await jsonOrThrow<unknown>(await fetch('/api/guestbook', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key }) }))
}

export type Activity = { repo?: string; url?: string; action?: string; at?: string }

export async function fetchActivity(): Promise<Activity> {
  return jsonOrThrow<Activity>(await fetch('/api/activity'))
}

export async function resolveHost(host: string): Promise<{ host: string; ip: string }> {
  return jsonOrThrow<{ host: string; ip: string }>(await fetch(`/api/resolve?host=${encodeURIComponent(host)}`))
}
