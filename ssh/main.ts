// SSH server for the portfolio: `ssh <host>` opens the terminal portfolio in
// the visitor's own terminal. Any username, no password, and no shell: the
// only thing a session can do is run the portfolio's built-in commands.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import ssh2 from 'ssh2'
import { profile, sshHost } from '../src/content'
import { setImageDirectory } from './images'
import { Session, visitor } from './session'

const here = dirname(fileURLToPath(import.meta.url))
const port = Number(process.env.PORT ?? 2222)
const apiBase = (process.env.API_BASE ?? profile.website).replace(/\/$/, '')
const limits = {
  total: Number(process.env.SSH_MAX_SESSIONS ?? 50),
  perIp: Number(process.env.SSH_MAX_PER_IP ?? 3),
  perIpPerMinute: Number(process.env.SSH_CONNECTS_PER_MINUTE ?? 10),
  idleMs: Number(process.env.SSH_IDLE_MINUTES ?? 10) * 60_000,
  maxMs: Number(process.env.SSH_MAX_MINUTES ?? 60) * 60_000,
  handshakeMs: 20_000,
}

setImageDirectory(process.env.SSH_IMAGES_DIR ?? join(here, 'images'))

function hostKey(): Buffer {
  const path = process.env.SSH_HOST_KEY ?? join(here, '..', '.dev_host_ed25519')
  if (existsSync(path)) return readFileSync(path)
  if (process.env.NODE_ENV === 'production') throw new Error(`SSH host key not found at ${path}`)
  const { private: key } = ssh2.utils.generateKeyPairSync('ed25519')
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, key, { mode: 0o600 })
  console.log(`generated a development host key at ${path}`)
  return Buffer.from(key)
}

// The portfolio's API calls use site-relative URLs; send them to the website
// and name the visitor so the site's per-visitor limits apply to them.
const nativeFetch = globalThis.fetch
globalThis.fetch = (input, init = {}) => {
  if (typeof input !== 'string' || !input.startsWith('/')) return nativeFetch(input, init)
  const headers = new Headers(init.headers)
  const session = visitor.getStore()
  if (session) headers.set('X-Forwarded-For', session.ip)
  headers.set('User-Agent', 'portfolio-ssh')
  const signal = init.signal ? AbortSignal.any([init.signal, AbortSignal.timeout(30_000)]) : AbortSignal.timeout(30_000)
  return nativeFetch(`${apiBase}${input}`, { ...init, headers, signal })
}

const active = new Map<string, number>()
const recent = new Map<string, number[]>()
let sessions = 0

// One IPv6 subscriber usually owns a whole /64.
const clientKey = (ip: string) => {
  const address = ip.replace(/^::ffff:/i, '')
  return address.includes(':') ? address.toLowerCase().split(':').slice(0, 4).join(':') : address
}

function admit(key: string): string | null {
  const now = Date.now()
  const times = (recent.get(key) ?? []).filter((time) => now - time < 60_000)
  times.push(now)
  recent.set(key, times)
  if (sessions >= limits.total) return 'The portfolio is busy right now. Please try again in a minute.'
  if ((active.get(key) ?? 0) >= limits.perIp) return 'Too many open sessions from your address.'
  if (times.length > limits.perIpPerMinute) return 'Too many connections from your address. Please wait a minute.'
  return null
}
setInterval(() => { const now = Date.now(); for (const [key, times] of recent) if (times.every((time) => now - time > 60_000)) recent.delete(key) }, 60_000).unref()

const server = new ssh2.Server({ hostKeys: [hostKey()], ident: `${profile.handle}-portfolio` }, (client, info) => {
  const ip = info.ip.replace(/^::ffff:/i, '')
  const key = clientKey(ip)
  const refusal = admit(key)
  // A flood gets no handshake at all; a polite refusal is shown to everyone else.
  if (refusal && (recent.get(key)?.length ?? 0) > limits.perIpPerMinute * 2) { client.on('error', () => {}); client.end(); return }
  let counted = false
  let shell: Session | null = null
  const handshake = setTimeout(() => client.end(), limits.handshakeMs)
  client.on('error', () => {})
  client.on('close', () => {
    clearTimeout(handshake)
    shell?.close()
    if (counted) {
      sessions--
      const left = (active.get(key) ?? 1) - 1
      if (left > 0) active.set(key, left)
      else active.delete(key)
    }
  })
  if (!refusal) {
    counted = true
    sessions++
    active.set(key, (active.get(key) ?? 0) + 1)
  }

  // Anyone may log in, with any name and no password.
  client.on('authentication', (context) => context.accept())
  client.on('ready', () => {
    clearTimeout(handshake)
    let opened = false
    client.on('session', (accept) => {
      if (opened) return
      opened = true
      const channel = accept()
      let pty: { cols: number; rows: number; term: string } | null = null
      const env: Record<string, string> = {}
      channel.on('pty', (ok, _reject, request) => { pty = { cols: request.cols, rows: request.rows, term: request.term }; ok?.() })
      channel.on('env', (ok, reject, request) => {
        if (Object.keys(env).length < 16 && /^(LC_TERMINAL|LC_TERMINAL_VERSION|TERM_PROGRAM|COLORTERM|LANG)$/.test(request.key) && request.val.length < 100) { env[request.key] = request.val; ok?.() } else reject?.()
      })
      channel.on('window-change', (ok, _reject, request) => { shell?.resize(request.cols, request.rows); ok?.() })
      channel.on('subsystem', (_ok, reject) => reject())
      channel.on('exec', (ok) => {
        const stream = ok()
        stream.write(`${profile.host} only offers the interactive portfolio. Connect with: ssh ${sshHost || profile.host}\r\n`)
        stream.exit(1)
        stream.end()
      })
      channel.on('shell', (ok) => {
        const stream = ok()
        if (refusal) { stream.write(`${refusal}\r\n`); stream.exit(1); stream.end(); return }
        if (!pty) {
          stream.write(`This portfolio needs a terminal. Connect with: ssh -t ${sshHost || profile.host}\r\n`)
          stream.exit(1)
          stream.end()
          return
        }
        const terminal = pty as { cols: number; rows: number; term: string }
        shell = new Session({
          ip, columns: terminal.cols, rows: terminal.rows, term: terminal.term, env, idleMs: limits.idleMs, maxMs: limits.maxMs,
          io: { write: (data) => { if (stream.writable) stream.write(data) }, close: () => { if (stream.writable) { stream.exit(0); stream.end() } client.end() } },
        })
        stream.on('data', (data: Buffer) => { try { shell?.input(data) } catch (error) { console.error(`session input failed: ${(error as Error).message}`) } })
        stream.on('close', () => shell?.close())
      })
    })
  })
})

server.on('error', (error: Error) => console.error(`ssh server error: ${error.message}`))
server.listen(port, '::', () => console.log(`portfolio SSH server listening on ${port}, API ${apiBase}`))
