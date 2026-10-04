// In-memory limits. The service runs as a single Lightsail container, so local
// state is enough; the global daily cap bounds Bedrock spend even under abuse.

const MINUTE = 60_000
const DAY = 24 * 60 * MINUTE

const chatMessages = {
  global: 'the assistant has hit its daily budget, try again tomorrow',
  day: "you've reached today's question limit, try again tomorrow",
  minute: 'slow down a little, try again in a minute',
}

export function createLimiter({ perMinute, perDay, globalPerDay, messages = chatMessages }) {
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

    if (global.count >= globalPerDay) return { ok: false, retryAfter: Math.ceil((global.resetAt - now) / 1000), reason: messages.global }
    if (client.day >= perDay) return { ok: false, retryAfter: Math.ceil((client.dayResetAt - now) / 1000), reason: messages.day }
    if (client.minute.length >= perMinute) return { ok: false, retryAfter: Math.ceil((MINUTE - (now - client.minute[0])) / 1000), reason: messages.minute }

    client.minute.push(now)
    client.day++
    global.count++
    return { ok: true }
  }
}

// Hosts allowed to forward a visitor's address, such as the SSH server.
const trustedRelays = new Set((process.env.TRUSTED_RELAYS ?? '').split(',').map((ip) => ip.trim().replace(/^::ffff:/i, '').toLowerCase()).filter(Boolean))

export function clientIp(request, relays = trustedRelays) {
  // The Lightsail load balancer appends the real client address, so take the
  // last hop; earlier entries are whatever the client chose to send. When that
  // client is a trusted relay, the hop it added names the visitor.
  const forwarded = request.headers['x-forwarded-for']
  const hops = (Array.isArray(forwarded) ? forwarded.join(',') : forwarded ?? '').split(',').map((hop) => hop.trim()).filter(Boolean)
  let last = hops.pop()
  if (last && hops.length && relays.has(last.replace(/^::ffff:/i, '').toLowerCase())) last = hops.pop()
  return clientKey(last || request.socket.remoteAddress || 'unknown')
}

// One IPv6 subscriber usually owns a whole /64, so count it as one client;
// otherwise a single visitor could rotate addresses past the per-visitor limits.
export function clientKey(address) {
  const ip = address.replace(/^::ffff:(?=\d+\.)/i, '')
  if (!ip.includes(':')) return ip
  const [head, tail = ''] = ip.toLowerCase().split('::')
  const left = head ? head.split(':') : []
  const right = tail ? tail.split(':') : []
  const groups = ip.includes('::') ? [...left, ...Array(Math.max(0, 8 - left.length - right.length)).fill('0'), ...right] : left
  return `${groups.slice(0, 4).map((group) => group.replace(/^0+(?=.)/, '')).join(':')}::/64`
}
