// "did you mean" suggestions: Levenshtein distance with a length-scaled cutoff,
// plus a cheap check for swapped neighbours (sl -> ls) which zsh users hit most.

export function distance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, index) => index)
  for (let i = 1; i <= a.length; i++) {
    let previous = row[0]!
    row[0] = i
    for (let j = 1; j <= b.length; j++) {
      const current = row[j]!
      row[j] = Math.min(row[j]! + 1, row[j - 1]! + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1))
      previous = current
    }
  }
  return row[b.length]!
}

const swapped = (a: string, b: string) => a.length === b.length && a.length > 1 && [...a].sort().join('') === [...b].sort().join('') && distance(a, b) === 2

export function closest(word: string, candidates: string[]): string | undefined {
  const needle = word.toLowerCase()
  if (!needle) return undefined
  const limit = needle.length <= 2 ? 0 : needle.length <= 4 ? 1 : 2
  let best: { candidate: string; score: number } | undefined
  for (const candidate of candidates) {
    const lower = candidate.toLowerCase()
    if (lower === needle) return candidate
    const score = swapped(needle, lower) ? 0.5 : distance(needle, lower)
    if (score <= Math.max(limit, swapped(needle, lower) ? 1 : 0) && (!best || score < best.score)) best = { candidate, score }
  }
  return best?.candidate
}

// Only treat input as a mistyped command when it looks like one: a short first
// word and at most a couple of plain arguments, never a sentence or question.
export function looksLikeCommand(input: string): boolean {
  const words = input.trim().split(/\s+/)
  return words.length <= 3 && !/[?]/.test(input) && words[0]!.length <= 12 && words.every((word) => /^[\w./~:-]+$/.test(word))
}
