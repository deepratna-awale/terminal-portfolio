import { describe, expect, it } from 'vitest'
import { matchPair, paragraph, search, wordBackward, wordEnd, wordForward } from './vim'

const text = ['const add = (a, b) => a + b', '', 'export { add }']

describe('vim motions', () => {
  it('moves by words', () => {
    expect(wordForward(text, { row: 0, col: 0 })).toEqual({ row: 0, col: 6 })
    expect(wordForward(text, { row: 0, col: 6 })).toEqual({ row: 0, col: 10 })
    expect(wordForward(text, { row: 0, col: 26 })).toEqual({ row: 1, col: 0 })
    expect(wordBackward(text, { row: 0, col: 10 })).toEqual({ row: 0, col: 6 })
    expect(wordBackward(text, { row: 2, col: 0 })).toEqual({ row: 1, col: 0 })
    expect(wordEnd(text, { row: 0, col: 0 })).toEqual({ row: 0, col: 4 })
  })

  it('jumps to matching brackets and paragraphs', () => {
    expect(matchPair(text, { row: 0, col: 12 })).toEqual({ row: 0, col: 17 })
    expect(matchPair(text, { row: 0, col: 17 })).toEqual({ row: 0, col: 12 })
    expect(matchPair(text, { row: 2, col: 0 })).toEqual({ row: 2, col: 13 })
    expect(paragraph(text, 0, 1)).toBe(1)
  })

  it('searches forward, backward and wraps', () => {
    expect(search(text, { row: 0, col: 0 }, 'add')).toEqual({ row: 0, col: 6 })
    expect(search(text, { row: 0, col: 6 }, 'add')).toEqual({ row: 2, col: 9 })
    expect(search(text, { row: 2, col: 9 }, 'add')).toEqual({ row: 0, col: 6 })
    expect(search(text, { row: 2, col: 9 }, 'add', true)).toEqual({ row: 0, col: 6 })
    expect(search(text, { row: 0, col: 0 }, 'nope')).toBeNull()
  })
})
