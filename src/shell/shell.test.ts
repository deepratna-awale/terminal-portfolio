import { describe, expect, it } from 'vitest'
import { commonPrefix, complete, suggestion } from './completion'
import { applyEdit, bindingFor, expandHistory, reverseSearch, type LineState } from './lineEditor'

const at = (value: string, cursor = value.length): LineState => ({ value, cursor, killRing: '' })

describe('line editor', () => {
  it('moves by words like zsh', () => {
    expect(applyEdit(at('cat projects/foo'), 'backward-word').cursor).toBe(13)
    expect(applyEdit(at('cat projects', 0), 'forward-word').cursor).toBe(3)
  })

  it('kills and yanks', () => {
    const killed = applyEdit(at('echo hello world'), 'backward-kill-word')
    expect(killed.value).toBe('echo hello ')
    expect(applyEdit({ ...killed, cursor: 0 }, 'yank').value).toBe('worldecho hello ')
    expect(applyEdit(at('echo hello', 4), 'kill-line').value).toBe('echo')
    expect(applyEdit(at('echo hello', 4), 'backward-kill-line')).toMatchObject({ value: ' hello', cursor: 0 })
  })

  it('transposes characters', () => {
    expect(applyEdit(at('sl'), 'transpose-chars').value).toBe('ls')
  })

  it('maps option keys by physical code', () => {
    expect(bindingFor({ key: '∫', code: 'KeyB', ctrlKey: false, altKey: true, metaKey: false })).toBe('backward-word')
    expect(bindingFor({ key: 'a', code: 'KeyA', ctrlKey: true, altKey: false, metaKey: false })).toBe('beginning-of-line')
    expect(bindingFor({ key: 'a', code: 'KeyA', ctrlKey: false, altKey: false, metaKey: true })).toBeNull()
  })

  it('expands history', () => {
    const history = ['ls media', 'cat about']
    expect(expandHistory('!!', history).value).toBe('cat about')
    expect(expandHistory('view !$', ['ls architecture.svg']).value).toBe('view architecture.svg')
    expect(expandHistory('!1', history).value).toBe('ls media')
    expect(expandHistory('!ls', history).value).toBe('ls media')
    expect(expandHistory('!nope', history).error).toContain('event not found')
  })

  it('reverse searches newest first', () => {
    expect(reverseSearch(['cat about', 'cat skills', 'ls'], 'cat')).toBe('cat skills')
    expect(reverseSearch(['cat about', 'cat skills', 'ls'], 'cat', 1)).toBe('cat about')
  })
})

describe('completion', () => {
  it('completes commands and directories', () => {
    expect(complete('proj', '~', [], []).candidates).toEqual(['projects'])
    expect(complete('cd ex', '~', [], []).candidates).toEqual(['experience/'])
    expect(complete('cat projects/Auto', '~', ['AutoExpress', 'sd-parsers'], []).candidates).toEqual(['AutoExpress'])
  })

  it('finds a common prefix', () => {
    expect(commonPrefix(['CivitAI-Model', 'CivitAI-Download'])).toBe('CivitAI-')
  })

  it('suggests from history first', () => {
    expect(suggestion('ca', ['cat about'], '~', [], [])).toBe('t about')
    expect(suggestion('neof', [], '~', [], [])).toBe('etch')
  })
})
