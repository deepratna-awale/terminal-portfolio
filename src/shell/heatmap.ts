// GitHub's contribution calendar as text: one column per week, Sunday on top.
export type ContributionDay = { date: string; level: number; count: number }

const glyphs = ['·', '░', '▒', '▓', '█']
const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const weekdays = ['    ', 'Mon ', '    ', 'Wed ', '    ', 'Fri ', '    ']

export function renderHeatmap(days: ContributionDay[], weeks = 53): string {
  const all = [...days].sort((a, b) => a.date.localeCompare(b.date))
  const lastWeek = all.length ? new Date(`${all.at(-1)!.date}T00:00:00Z`).getUTCDay() + 1 : 0
  const sorted = all.slice(Math.max(0, all.length - ((weeks - 1) * 7 + lastWeek)))
  if (!sorted.length) return '(no contribution data)'
  const offset = new Date(`${sorted[0]!.date}T00:00:00Z`).getUTCDay()
  const columns = Math.ceil((sorted.length + offset) / 7)
  const grid = Array.from({ length: 7 }, () => Array.from({ length: columns }, () => ' '))
  const labels = Array.from({ length: columns + 3 }, () => ' ')
  let lastMonth = -1
  sorted.forEach((day, index) => {
    const slot = index + offset
    const column = Math.floor(slot / 7)
    grid[slot % 7]![column] = glyphs[Math.min(4, Math.max(0, day.level))]!
    const month = Number(day.date.slice(5, 7)) - 1
    if (month !== lastMonth && labels.slice(Math.max(0, column - 1), column + 3).every((cell) => cell === ' ')) {
      months[month]!.split('').forEach((char, charIndex) => { labels[column + charIndex] = char })
    }
    lastMonth = month
  })
  return [`    ${labels.join('')}`.trimEnd(), ...grid.map((row, index) => `${weekdays[index]}${row.join('')}`.trimEnd())].join('\n')
}
