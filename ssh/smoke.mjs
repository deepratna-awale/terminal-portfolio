// Connects to a running SSH server like a visitor would, runs a few commands
// and checks the output. Used by CI: node ssh/smoke.mjs [port]
import ssh2 from 'ssh2'

const port = Number(process.argv[2] ?? 2222)
const script = process.argv.slice(3)
const commands = script.length ? script : ['help', 'about', 'cat contact | grep -i email', 'view architecture.svg', 'exit']
const expect = [/Portfolio/, /About|Senior Software Engineer/, /email/i, /architecture/i]
const strip = (text) => text.replace(/\x1b\[[0-9;?]*[ -/]*[@-~]|\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)|\x1b[P_][^\x1b]*\x1b\\/g, '')

const client = new ssh2.Client()
let output = ''
const fail = (message) => { console.error(message); console.error(strip(output).slice(-3000)); process.exit(1) }
const timer = setTimeout(() => fail('timed out'), 30_000)
client.on('ready', () => {
  client.shell({ term: 'xterm-256color', cols: 100, rows: 40 }, (error, stream) => {
    if (error) fail(error.message)
    stream.on('data', (chunk) => {
      output += chunk.toString()
      // Answer the login probe like a terminal without image support.
      if (output.includes('\x1b[c') && !output.includes('answered')) { output += 'answered'; stream.write('\x1b[?62;22c') }
    })
    stream.on('close', () => {
      clearTimeout(timer)
      const text = strip(output)
      for (const pattern of script.length ? [] : expect) if (!pattern.test(text)) fail(`missing ${pattern}`)
      if (script.length) console.log(text)
      else console.log(`ok: ${commands.length} commands, ${text.length} characters of output`)
      client.end()
    })
    let index = 0
    const next = () => { if (index < commands.length) { stream.write(`${commands[index++]}\r`); setTimeout(next, 700) } }
    setTimeout(next, 1200)
  })
})
client.on('error', (error) => fail(error.message))
client.connect({ host: '127.0.0.1', port, username: 'smoke-test', hostVerifier: () => true })
