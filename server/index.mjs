import { spawn } from 'node:child_process'
import { createReadStream, existsSync, statSync } from 'node:fs'
import { extname, join, normalize, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'node:http'

const root = fileURLToPath(new URL('../dist', import.meta.url))
const port = Number(process.env.PORT ?? 8787)
const maxCowthinkLength = 280
const securityHeaders = {
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' data: https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'",
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
}
const mimeTypes = { '.css': 'text/css', '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' }

function sendText(response, status, body, contentType = 'text/plain') {
  response.writeHead(status, { 'Content-Type': `${contentType}; charset=utf-8`, 'Cache-Control': 'no-store' })
  response.end(body)
}

function runFortune(response) {
  const fortune = spawn('fortune', [], { timeout: 3000 })
  let output = ''
  fortune.stdout.on('data', (chunk) => { output += chunk.toString() })
  fortune.stderr.on('data', () => {})
  fortune.on('error', () => sendText(response, 503, 'fortune is unavailable in this runtime'))
  fortune.on('close', (code) => {
    if (response.writableEnded) return
    if (code !== 0 || !output.trim()) return sendText(response, 503, 'fortune is unavailable in this runtime')
    sendText(response, 200, output.trim())
  })
}

function runCowthink(response, text) {
  // `--` stops user text from being parsed as cowthink options (e.g. -f <file>).
  const cowthink = spawn('cowthink', ['-f', 'tux', '--', text], { timeout: 3000 })
  let output = ''
  cowthink.stdout.on('data', (chunk) => { output += chunk.toString() })
  cowthink.stderr.on('data', () => {})
  cowthink.on('error', () => sendText(response, 503, 'cowthink is unavailable in this runtime'))
  cowthink.on('close', (code) => {
    if (response.writableEnded) return
    if (code !== 0 || !output.trim()) return sendText(response, 503, 'cowthink is unavailable in this runtime')
    sendText(response, 200, output.trim())
  })
}

function sendFile(response, filePath, headers) {
  const stream = createReadStream(filePath)
  stream.on('error', () => {
    if (!response.headersSent) sendText(response, 500, 'internal error')
    else response.destroy()
  })
  stream.once('open', () => {
    response.writeHead(200, headers)
    stream.pipe(response)
  })
}

function serveStatic(requestPath, response) {
  const requested = requestPath === '/' ? '/index.html' : requestPath
  const filePath = normalize(join(root, requested))
  if (!filePath.startsWith(root + sep) || !existsSync(filePath) || !statSync(filePath).isFile()) {
    sendFile(response, join(root, 'index.html'), { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' })
    return
  }
  const cacheControl = requested.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'public, max-age=300'
  sendFile(response, filePath, { 'Content-Type': mimeTypes[extname(filePath)] ?? 'application/octet-stream', 'Cache-Control': cacheControl })
}

function cowthinkText(raw) {
  // Strip control characters and cap length so one request can't make the cow huge.
  const text = (raw ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, maxCowthinkLength)
  return text || 'moo'
}

createServer((request, response) => {
  for (const [name, value] of Object.entries(securityHeaders)) response.setHeader(name, value)
  // A malformed request target (e.g. `//[`) makes URL throw; left uncaught it kills the process.
  let requestUrl
  try {
    requestUrl = new URL(request.url ?? '/', 'http://localhost')
  } catch {
    return sendText(response, 400, 'bad request')
  }
  if (requestUrl.pathname === '/health') return sendText(response, 200, 'ok')
  if (requestUrl.pathname === '/api/fortune' && request.method === 'GET') return runFortune(response)
  if (requestUrl.pathname === '/api/cowthink' && request.method === 'GET') return runCowthink(response, cowthinkText(requestUrl.searchParams.get('text')))
  if (requestUrl.pathname.startsWith('/api/')) return sendText(response, 404, 'not found')
  serveStatic(requestUrl.pathname, response)
}).listen(port, () => console.log(`portfolio server listening on ${port}`))
