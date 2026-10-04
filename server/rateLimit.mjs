// In-memory limits. The service runs as a single Lightsail container, so local
// state is enough; the global daily cap bounds Bedrock spend even under abuse.

const MINUTE = 60_000
const DAY = 24 * 60 * MINUTE

export function createLimiter({ perMinute, perDay, globalPerDay }) {
  const clients = new Map()
  let global = { count: 0, resetAt: Date.now() + DAY }

  setInterval(() => {
    const now = Date.now()
    for (const [key, client] of clients) if (client.dayResetAt < now) clients.delete(key)
  }, 10 * MINUTE).unref()

  return function check(key) {
    const now = Date.now()
    if (global.resetAt < now) global = { count: 0, resetAt: now + DAY }
    const client = clients.get(key) ?? { minute: [], day: 0, dayResetAt: now + DAY }
    if (client.dayResetAt < now) { client.day = 0; client.dayResetAt = now + DAY }
    client.minute = client.minute.filter((time) => now - time < MINUTE)
    clients.set(key, client)

    if (global.count >= globalPerDay) return { ok: false, retryAfter: Math.ceil((global.resetAt - now) / 1000), reason: 'the assistant has hit its daily budget, try again tomorrow' }
    if (client.day >= perDay) return { ok: false, retryAfter: Math.ceil((client.dayResetAt - now) / 1000), reason: "you've reached today's question limit, try again tomorrow" }
    if (client.minute.length >= perMinute) return { ok: false, retryAfter: Math.ceil((MINUTE - (now - client.minute[0])) / 1000), reason: 'slow down a little, try again in a minute' }

    client.minute.push(now)
    client.day++
    global.count++
    return { ok: true }
  }
}

export function clientIp(request) {
  // The Lightsail load balancer appends the real client address, so take the
  // last hop; earlier entries are whatever the client chose to send.
  const forwarded = request.headers['x-forwarded-for']
  const last = (Array.isArray(forwarded) ? forwarded.join(',') : forwarded)?.split(',').at(-1)
  return (last || request.socket.remoteAddress || 'unknown').trim()
}
