// Turns the terminal's markdown content into structured data for the GUI.

export type Job = { role: string; company: string; dates: string; location: string; notes: string[]; bullets: string[] }
export type SkillGroup = { category: string; items: string[] }
export type Paper = { title: string; venue: string; summary: string; links: string }
export type Degree = { title: string; school: string; notes: string[] }
export type Fact = { label: string; value: string }

const blocks = (lines: string[]) => {
  const out: Array<{ title: string; lines: string[] }> = []
  for (const line of lines) {
    if (line.startsWith('## ')) out.push({ title: line.slice(3).trim(), lines: [] })
    else out.at(-1)?.lines.push(line)
  }
  return out
}

export function parseExperience(lines: string[]): { jobs: Job[]; earlier: string } {
  const earlier = lines.find((line) => /^Earlier:/.test(line)) ?? ''
  const jobs = blocks(lines.filter((line) => line !== earlier)).map(({ title, lines: body }) => {
    const job: Job = { role: title, company: '', dates: '', location: '', notes: [], bullets: [] }
    for (const line of body) {
      const meta = /^\*\*(.+?)\*\*\s*(.*?)\s*\[(.+?)\]\s*\|\s*(.+)$/.exec(line)
      if (meta && !job.company) Object.assign(job, { company: `${meta[1]}${meta[2] ? ` ${meta[2]}` : ''}`, dates: meta[3]!.replace(/ to /, ' – '), location: meta[4] })
      else if (line.startsWith('- ')) job.bullets.push(line.slice(2))
      else if (line.trim()) job.notes.push(line)
    }
    return job
  })
  return { jobs, earlier: earlier.replace(/^Earlier:\s*/, '') }
}

export function parseSkills(lines: string[]): SkillGroup[] {
  return lines.flatMap((line) => {
    const match = /^\*\*(.+?)\*\*\s+(.+)$/.exec(line.trim())
    return match ? [{ category: match[1]!.trim(), items: match[2]!.split(/\s{2,}/).map((item) => item.trim()).filter(Boolean) }] : []
  })
}

export function parsePublications(lines: string[]): Paper[] {
  return blocks(lines).map(({ title, lines: body }) => {
    const text = body.filter((line) => line.trim())
    const description = text.find((line) => !/^\[/.test(line)) ?? ''
    const venue = /^([^.]+?,\s*\d{4})\.\s*(.*)$/.exec(description)
    return { title, venue: venue?.[1] ?? '', summary: venue?.[2] ?? description, links: text.filter((line) => /^\[/.test(line)).join(' ') }
  })
}

export function parseEducation(lines: string[]): { degrees: Degree[]; certifications: string[] } {
  const degrees: Degree[] = []
  const certifications: string[] = []
  let certs = false
  for (const line of lines) {
    if (!line.trim()) continue
    if (/^certifications$/i.test(line.trim())) { certs = true; continue }
    if (certs) { certifications.push(line.trim()); continue }
    const match = /^\*\*(.+?)\*\*\s+(.+)$/.exec(line)
    if (match) degrees.push({ title: match[1]!, school: match[2]!.trim(), notes: [] })
    else degrees.at(-1)?.notes.push(line.trim())
  }
  return { degrees, certifications }
}

// `**Label:** value` lines become facts, the rest stays prose. Terminal-only hints are dropped.
export function parseAbout(lines: string[]): { pitch: string; prose: string[]; facts: Fact[] } {
  const body = lines.filter((line) => line.trim() && !line.startsWith('# ') && !/^Try /.test(line))
  const facts: Fact[] = []
  const prose: string[] = []
  for (const line of body) {
    const fact = /^\*\*(.+?):\*\*\s*(.+)$/.exec(line)
    if (fact) facts.push({ label: fact[1]!, value: fact[2]! })
    else prose.push(line)
  }
  // The pitch opens with the bolded job title, which the hero already shows.
  const pitch = (prose[0] ?? '').replace(/^\*\*[^*]+\*\*\s*/, '')
  return { pitch: pitch.charAt(0).toUpperCase() + pitch.slice(1), prose: prose.slice(1), facts }
}

export const splitYear = (text: string) => {
  const match = /^(.*?)\s*\((\d{4})\)$/.exec(text)
  return match ? { name: match[1]!, year: match[2]! } : { name: text, year: '' }
}
