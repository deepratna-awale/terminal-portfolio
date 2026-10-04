// The offline T-rex runner from chrome://dino. Units are canvas pixels and seconds; y is height above the ground.
export type Rng = () => number
export type Cactus = { x: number; width: number; height: number }
export type DinoState = { y: number; vy: number; cacti: Cactus[]; speed: number; distance: number; gap: number; alive: boolean }

export const DINO_WIDTH = 600
export const DINO_X = 24
export const REX = { width: 40, height: 36 }
const GRAVITY = 2600
const JUMP = 760
const START_SPEED = 360
const MAX_SPEED = 820

export const createDino = (): DinoState => ({ y: 0, vy: 0, cacti: [], speed: START_SPEED, distance: 0, gap: DINO_WIDTH * 0.6, alive: true })

export const jump = (state: DinoState): DinoState => (state.alive && state.y === 0 ? { ...state, vy: JUMP } : state)

export const score = (state: DinoState) => Math.floor(state.distance / 40)

const hits = (y: number, cactus: Cactus) => {
  // Forgiving boxes: the sprite's corners are empty.
  const left = DINO_X + 8, right = DINO_X + REX.width - 8
  return cactus.x + 3 < right && cactus.x + cactus.width - 3 > left && y + 4 < cactus.height
}

export function stepDino(state: DinoState, dt: number, rng: Rng = Math.random): DinoState {
  if (!state.alive) return state
  const vy = state.vy - GRAVITY * dt
  const y = Math.max(0, state.y + vy * dt)
  const move = state.speed * dt
  let cacti = state.cacti.map((cactus) => ({ ...cactus, x: cactus.x - move })).filter((cactus) => cactus.x + cactus.width > 0)
  let gap = state.gap - move
  if (gap <= 0) {
    const count = 1 + Math.floor(rng() * 3)
    const big = rng() < 0.4
    cacti = [...cacti, { x: DINO_WIDTH, width: count * (big ? 25 : 17), height: big ? 50 : 35 }]
    gap = (state.speed / START_SPEED) * (260 + rng() * 360)
  }
  const distance = state.distance + move
  const speed = Math.min(MAX_SPEED, state.speed + dt * 6)
  return { y, vy: y === 0 ? 0 : vy, cacti, speed, distance, gap, alive: !cacti.some((cactus) => hits(y, cactus)) }
}
