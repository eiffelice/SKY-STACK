export const GAME_WIDTH = 400;
export const START_WIDTH = 190;
export const MIN_WIDTH = 18;
export const MAX_FLOORS = 100;
export const TICKS_PER_SECOND = 60;
export const BALANCE_LIMIT = 80;

export function speedForFloor(floor) {
  return Math.min(4.8, 1.65 + floor * 0.105);
}

export function positionAt(floor, width, tick, seed) {
  const travel = GAME_WIDTH - width;
  const phase = (seed % 31) / 31 * 40;
  const distance = (tick * speedForFloor(floor) + phase) % (travel * 2);
  return distance <= travel ? distance : travel * 2 - distance;
}

// Positive wind pushes the building to the right. It is fixed for each run/floor.
export function windForFloor(seed, floor) {
  return Math.round(Math.sin(seed * 0.000013 + floor * 1.91) * Math.min(24, 8 + floor * 0.45));
}

export function initialState(seed) {
  return { seed, floor: 0, x: (GAME_WIDTH - START_WIDTH) / 2,
    width: START_WIDTH, score: 0, combo: 0, perfects: 0, balance: 0, braces: 1,
    status: 'playing', blocks: [{ x: (GAME_WIDTH - START_WIDTH) / 2, width: START_WIDTH, floor: 0 }] };
}

export function placeBlock(state, tick, brace = false) {
  if (state.status !== 'playing' || !Number.isInteger(tick) || tick < 18 || tick > 600 ||
      typeof brace !== 'boolean' || (brace && state.braces < 1)) {
    throw new Error('Invalid placement');
  }
  const movingX = positionAt(state.floor, state.width, tick, state.seed);
  const left = Math.max(movingX, state.x);
  const right = Math.min(movingX + state.width, state.x + state.width);
  const overlap = Math.max(0, right - left);
  const perfect = Math.abs(movingX - state.x) <= 6;
  if (overlap < MIN_WIDTH) {
    return { ...state, status: 'gameover', last: { movingX, perfect: false, overlap: 0, cause: 'miss' } };
  }
  const width = perfect ? state.width : overlap;
  const x = perfect ? state.x : left;
  const combo = perfect ? state.combo + 1 : 0;
  const score = state.score + (perfect ? 100 + Math.min(combo, 20) * 25 : 50 + Math.round(overlap / state.width * 50));
  const floor = state.floor + 1;
  const perfects = state.perfects + Number(perfect);
  const rawBalance = state.balance * 0.78 + (movingX - state.x) / state.width * 55 + windForFloor(state.seed, state.floor);
  const balance = Math.round(rawBalance * (brace ? 0.32 : 1) * (perfect ? 0.45 : 1) * 100) / 100;
  const braces = Math.min(2, state.braces - Number(brace) + Number(perfect && perfects % 3 === 0));
  const status = Math.abs(balance) >= BALANCE_LIMIT ? 'gameover' : floor >= MAX_FLOORS ? 'complete' : 'playing';
  return { ...state, floor, x, width, combo, score, balance, braces, perfects,
    status,
    blocks: [...state.blocks, { x, width, floor }],
    last: { movingX, perfect, overlap, brace, cause: status === 'gameover' ? 'collapse' : null } };
}

export function replay(seed, ticks, braces = []) {
  if (!Array.isArray(ticks) || ticks.length < 2 || ticks.length > MAX_FLOORS + 1) {
    throw new Error('Invalid replay length');
  }
  if (!Array.isArray(braces) || braces.length > ticks.length ||
      braces.some((index, i) => !Number.isInteger(index) || index < 0 || index >= ticks.length || (i && index <= braces[i - 1]))) {
    throw new Error('Invalid brace log');
  }
  let state = initialState(seed);
  for (const [index, tick] of ticks.entries()) state = placeBlock(state, tick, braces.includes(index));
  if (state.status === 'playing') throw new Error('Run is unfinished');
  return state;
}

