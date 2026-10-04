// Runs one typed line (without && or ;): a pipeline, a command, a typo
// suggestion or, failing those, a question for the assistant. Shared by the
// browser terminal and the SSH server.
import { fetchCowthink } from '../api'
import { commands, commandNames, directories, resolveAlias, tokenize, type NewLine, type ShellContext } from './commands'
import { pipeSplit } from './deeplink'
import { filterNames, filters, toPlainText } from './pipes'
import { closest, looksLikeCommand } from './typo'

export async function runPipeline(stages: string[], ctx: ShellContext) {
  const { print } = ctx
  const captured: NewLine[] = []
  const [first = '', ...rest] = stages
  const [name = '', ...args] = tokenize(resolveAlias(first))
  const command = commands[name]
  if (!command) { print([{ type: 'error', text: `zsh: command not found: ${name}` }]); return }
  await command.run(args, { ...ctx, print: (lines) => {
    captured.push(...lines.filter((line) => line.type !== 'muted' && line.type !== 'error'))
    const errors = lines.filter((line) => line.type === 'error')
    if (errors.length) print(errors)
  } })
  let lines = captured.flatMap((line) => (line.type === 'neofetch' ? [line.text, ...(line.info ?? [])] : toPlainText(line.text).split('\n')))
  let art = false
  for (const stage of rest) {
    const [filter = '', ...filterArgs] = tokenize(stage)
    if (filter === 'cowthink' || filter === 'cowsay') {
      art = true
      try { lines = (await fetchCowthink(lines.join(' ').replace(/\s+/g, ' ').slice(0, 280))).split('\n') } catch (error) { print([{ type: 'error', text: error instanceof Error ? error.message : 'cowthink is unavailable' }]); return }
      continue
    }
    if (filter === 'less' || filter === 'more' || filter === 'cat') continue
    const apply = filters[filter]
    if (!apply) { const guess = closest(filter, [...filterNames, 'cowthink']); print([{ type: 'error', text: `zsh: command not found: ${filter}` }, ...(guess ? [{ type: 'muted' as const, text: `did you mean \`${guess}\`? Pipes support: ${filterNames.join(', ')}, cowthink` }] : [])]); return }
    const result = apply(lines, filterArgs)
    if (!Array.isArray(result)) { print([{ type: 'error', text: result.error }]); return }
    lines = result
  }
  print([art ? { type: 'output', text: `\`\`\`text\n${lines.join('\n')}\n\`\`\`` } : { type: 'plain', text: lines.join('\n') || '(no output)' }])
}

export async function runInput(raw: string, ctx: ShellContext) {
  const segments = pipeSplit(raw)
  if (segments.length > 1) { await runPipeline(segments, ctx); return }
  const [name = '', ...args] = tokenize(resolveAlias(raw))
  const command = commands[name] ?? commands[name.toLowerCase()]
  if (command) { await command.run(args, ctx); return }
  if (looksLikeCommand(raw) && raw.length < 40) {
    const guess = closest(name, commandNames.filter((candidate) => !commands[candidate]?.hidden || candidate.length > 2))
    if (guess) {
      const fixed = [guess, ...args].join(' ')
      ctx.print([{ type: 'error', text: `zsh: command not found: ${name}` }, { type: 'muted', text: `did you mean [\`${fixed}\`](cmd:${encodeURIComponent(fixed)})?` }])
      return
    }
    if (raw.trim().split(/\s+/).length === 1 && directories.includes(name.replace(/\/$/, ''))) { await commands.cd!.run([name], ctx); return }
  }
  await ctx.ask(raw.trim())
}
