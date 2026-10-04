import { spawn } from 'node:child_process'
import { createReadStream, existsSync, statSync } from 'node:fs'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'node:http'

const root = fileURLToPath(new URL('../dist', import.meta.url))
const port = Number(process.env.PORT ?? 8787)
const mimeTypes = { '.css': 'text/css', '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' }

function sendText(response, status, body, contentType = 'text/plain') {
  response.writeHead(status, { 'Content-Type': `${contentType}; charset=utf-8` })
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
  const cowthink = spawn('cowthink', ['-f', 'tux', text], { timeout: 3000 })
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

function serveStatic(requestPath, response) {
  const requested = requestPath === '/' ? '/index.html' : requestPath
  const filePath = normalize(join(root, requested))
  if (!filePath.startsWith(root) || !existsSync(filePath) || !statSync(filePath).isFile()) {
    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    createReadStream(join(root, 'index.html')).pipe(response)
    return
  }
  const cacheControl = requested.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'public, max-age=300'
  response.writeHead(200, { 'Content-Type': mimeTypes[extname(filePath)] ?? 'application/octet-stream', 'Cache-Control': cacheControl })
  createReadStream(filePath).pipe(response)
}

createServer((request, response) => {
  const requestUrl = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`)
  if (requestUrl.pathname === '/health') return sendText(response, 200, 'ok')
  if (requestUrl.pathname === '/api/fortune' && request.method === 'GET') return runFortune(response)
  if (requestUrl.pathname === '/api/cowthink' && request.method === 'GET') return runCowthink(response, requestUrl.searchParams.get('text') ?? 'moo')
  if (requestUrl.pathname.startsWith('/api/')) return sendText(response, 404, 'not found')
  serveStatic(requestUrl.pathname, response)
}).listen(port, () => console.log(`portfolio server listening on ${port}`))
