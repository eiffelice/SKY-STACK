export const GAME_WIDTH = 400;
export const START_WIDTH = 190;
export const MIN_WIDTH = 18;
export const MAX_FLOORS = 100;
export const TICKS_PER_SECOND = 60;

export function speedForFloor(floor) {
  return Math.min(4.8, 1.65 + floor * 0.105);
}

export function positionAt(floor, width, tick, seed) {
  const travel = GAME_WIDTH - width;
  const phase = (seed % 31) / 31 * 40;
  const distance = (tick * speedForFloor(floor) + phase) % (travel * 2);
  return distance <= travel ? distance : travel * 2 - distance;
}

export function initialState(seed) {
  return { seed, floor: 0, x: (GAME_WIDTH - START_WIDTH) / 2,
    width: START_WIDTH, score: 0, combo: 0, perfects: 0,
    status: 'playing', blocks: [{ x: (GAME_WIDTH - START_WIDTH) / 2, width: START_WIDTH, floor: 0 }] };
}

export function placeBlock(state, tick) {
  if (state.status !== 'playing' || !Number.isInteger(tick) || tick < 18 || tick > 600) {
    throw new Error('Invalid placement');
  }
  const movingX = positionAt(state.floor, state.width, tick, state.seed);
  const left = Math.max(movingX, state.x);
  const right = Math.min(movingX + state.width, state.x + state.width);
  const overlap = Math.max(0, right - left);
  const perfect = Math.abs(movingX - state.x) <= 6;
  if (overlap < MIN_WIDTH) {
    return { ...state, status: 'gameover', last: { movingX, perfect: false, overlap: 0 } };
  }
  const width = perfect ? state.width : overlap;
  const x = perfect ? state.x : left;
  const combo = perfect ? state.combo + 1 : 0;
  const score = state.score + (perfect ? 100 + Math.min(combo, 20) * 25 : 50 + Math.round(overlap / state.width * 50));
  const floor = state.floor + 1;
  return { ...state, floor, x, width, combo, score,
    perfects: state.perfects + Number(perfect),
    status: floor >= MAX_FLOORS ? 'complete' : 'playing',
    blocks: [...state.blocks, { x, width, floor }],
    last: { movingX, perfect, overlap } };
}

export function replay(seed, ticks) {
  if (!Array.isArray(ticks) || ticks.length < 2 || ticks.length > MAX_FLOORS + 1) {
    throw new Error('Invalid replay length');
  }
  let state = initialState(seed);
  for (const tick of ticks) state = placeBlock(state, tick);
  if (state.status === 'playing') throw new Error('Run is unfinished');
  return state;
}

