import { describe, expect, it } from 'vitest'
import { resizeRect } from './useWindowFrame'

const start = { x: 100, y: 100, width: 400, height: 300 }

describe('mac-style window resizing', () => {
  it('keeps the opposite edge anchored', () => {
    expect(resizeRect(start, 'e', 50, 0)).toEqual({ x: 100, y: 100, width: 450, height: 300 })
    expect(resizeRect(start, 'w', 50, 0)).toEqual({ x: 150, y: 100, width: 350, height: 300 })
    expect(resizeRect(start, 'nw', -20, -10)).toEqual({ x: 80, y: 90, width: 420, height: 310 })
  })

  it('resizes around the centre with Option', () => {
    expect(resizeRect(start, 'e', 50, 0, { center: true })).toEqual({ x: 50, y: 100, width: 500, height: 300 })
  })

  it('keeps the aspect ratio with Shift on a corner', () => {
    const next = resizeRect(start, 'se', 100, 0, { aspect: true })
    expect(next.width / next.height).toBeCloseTo(4 / 3)
    expect(next).toMatchObject({ x: 100, y: 100, width: 500 })
  })

  it('stops at the minimum size from the anchored side', () => {
    expect(resizeRect(start, 'w', 390, 0, {}, { width: 200, height: 100 })).toEqual({ x: 300, y: 100, width: 200, height: 300 })
  })
})
