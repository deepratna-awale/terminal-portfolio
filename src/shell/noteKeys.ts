// Delete keys for the guestbook notes this visitor posted. The browser keeps
// them in localStorage; an SSH session keeps them in memory and shows the key
// once so the visitor can delete the note in a later session.
export type SavedNote = { key: string; message: string; at: string }
export type NoteKeys = { persistent: boolean; list: () => SavedNote[]; add: (note: SavedNote) => void; remove: (key: string) => void }

const STORAGE_KEY = 'portfolio.guestbook-keys'
export const noteId = (key: string) => key.split('.')[0] ?? ''

export function memoryNoteKeys(): NoteKeys {
  let notes: SavedNote[] = []
  return {
    persistent: false,
    list: () => notes,
    add: (note) => { notes = [note, ...notes.filter((item) => item.key !== note.key)] },
    remove: (key) => { notes = notes.filter((item) => item.key !== key) },
  }
}

export function browserNoteKeys(): NoteKeys {
  const read = (): SavedNote[] => {
    try {
      const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
      return Array.isArray(parsed) ? parsed.filter((item): item is SavedNote => typeof item?.key === 'string' && typeof item.message === 'string') : []
    } catch { return [] }
  }
  const write = (notes: SavedNote[]) => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(notes.slice(0, 50))) } catch { /* storage unavailable */ } }
  let persistent = false
  try { localStorage.setItem(`${STORAGE_KEY}-test`, '1'); localStorage.removeItem(`${STORAGE_KEY}-test`); persistent = true } catch { /* private mode or blocked */ }
  return {
    persistent,
    list: read,
    add: (note) => write([note, ...read().filter((item) => item.key !== note.key)]),
    remove: (key) => write(read().filter((item) => item.key !== key)),
  }
}
