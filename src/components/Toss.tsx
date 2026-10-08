import type { CSSProperties } from 'react'
import { profile } from '../content'

export type TossResult = { kind: 'coin'; heads: boolean } | { kind: 'die'; value: number }

// Die faces: which 3x3 cells hold a pip, and the cube rotation that brings each face to the front.
const PIPS: Record<number, number[]> = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] }
const FACES: [number, string][] = [[1, 'rotateY(0deg)'], [6, 'rotateY(180deg)'], [3, 'rotateY(90deg)'], [4, 'rotateY(-90deg)'], [2, 'rotateX(90deg)'], [5, 'rotateX(-90deg)']]
const LAND: Record<number, [number, number]> = { 1: [0, 0], 6: [0, 180], 3: [0, -90], 4: [0, 90], 2: [-90, 0], 5: [90, 0] }

const tossLabel = (result: TossResult) => (result.kind === 'coin' ? (result.heads ? 'Heads' : 'Tails') : `You rolled a ${result.value}`)

export function Toss({ result, onDone }: { result: TossResult; onDone: () => void }) {
  const label = tossLabel(result)
  let stage
  if (result.kind === 'coin') {
    stage = (
      <div className="cb-coin" style={{ '--end': `${result.heads ? 1800 : 1980}deg` } as CSSProperties}>
        <span className="cb-coin-face"><b>{profile.initials}</b><small>Heads</small></span>
        <span className="cb-coin-face back"><b>★</b><small>Tails</small></span>
      </div>
    )
  } else {
    const [x, y] = LAND[result.value]!
    stage = (
      <div className="cb-die" style={{ '--end-x': `${x + 720}deg`, '--end-y': `${y + 1080}deg` } as CSSProperties}>
        {FACES.map(([value, turn]) => (
          <span key={value} className="cb-die-face" style={{ transform: `${turn} translateZ(40px)` }}>
            {Array.from({ length: 9 }, (_, cell) => <i key={cell} className={PIPS[value]!.includes(cell) ? 'pip' : undefined} />)}
          </span>
        ))}
      </div>
    )
  }
  return (
    <div className="cb-toss" role="status" aria-label={label} onPointerDown={onDone} onAnimationEnd={(event) => { if (event.target === event.currentTarget) onDone() }}>
      <div className="cb-toss-stage" aria-hidden="true">{stage}</div>
      <p className="cb-toss-label" aria-hidden="true">{label}</p>
    </div>
  )
}
