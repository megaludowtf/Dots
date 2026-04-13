// @ts-nocheck
// Client-side mirror of src/DotsArt.sol.
// Accepts a Check object (seed, divisorIndex, merges, colorBandIdx, gradientIdx,
// direction, isMega) and returns an SVG string matching what the contract renders.

// 80-colour sorted gradient palette — matches src/libraries/EightyColors.sol.
const EIGHTY_COLORS = [
  "E84AA9","F2399D","DB2F96","E73E85","FF7F8E","FA5B67","E8424E","D5332F",
  "C23532","F2281C","D41515","9D262F","DE3237","DA3321","EA3A2D","EB4429",
  "EC7368","FF8079","FF9193","EA5B33","D05C35","ED7C30","EF9933","EF8C37",
  "F18930","F09837","F9A45C","F2A43A","F2A840","F2A93C","FFB340","F2B341",
  "FAD064","F7CA57","F6CB45","FFAB00","F4C44A","FCDE5B","F9DA4D","F9DA4A",
  "FAE272","F9DB49","FAE663","FBEA5B","A7CA45","B5F13B","94E337","63C23C",
  "86E48E","77E39F","5FCD8C","83F1AE","9DEFBF","2E9D9A","3EB8A1","5FC9BF",
  "77D3DE","6AD1DE","5ABAD3","4291A8","33758D","45B2D3","81D1EC","A7DDF9",
  "9AD9FB","A4C8EE","60B1F4","2480BD","4576D0","3263D0","2E4985","25438C",
  "525EAA","3D43B3","322F92","4A2387","371471","3B088C","6C31D7","9741DA",
];

const COLOR_BANDS = [80, 60, 40, 20, 10, 5, 1];
const GRADIENTS = [0, 1, 2, 5, 8, 9, 10];

const SYMBOL_M = `<symbol id="m" viewBox="0 0 105 105">
<path d="M62.7534 81.6321C65.9781 81.6321 68.5825 79.0297 68.5825 75.8195C68.5825 72.6093 65.9781 70.0068 62.7534 70.0068C59.5536 70.0068 56.9492 72.6093 56.9492 75.8195C56.9492 79.0297 59.5536 81.6321 62.7534 81.6321Z" fill="#19191A"/>
<path d="M41.8648 81.805C45.0894 81.805 47.6693 79.2026 47.6693 75.9923C47.6693 72.7821 45.0894 70.1797 41.8648 70.1797C38.665 70.1797 36.0605 72.7821 36.0605 75.9923C36.0605 79.2026 38.665 81.805 41.8648 81.805Z" fill="#19191A"/>
<path d="M29.1376 21.0791H42.9855C45.5913 28.1286 52.3911 48.1021 52.8874 49.215C53.0115 48.6586 59.8608 26.8919 61.7966 21.2028H76.1904V70.8582C74.4036 69.8687 72.6166 68.8795 70.6809 67.7662C69.3407 67.0863 68.1 66.344 66.7351 65.7875C66.611 56.1409 66.487 46.5561 66.1892 36.5385C64.2535 42.2894 57.5776 62.5721 57.0316 63.1286H48.1225C48.1225 63.1286 39.4613 38.5172 39.0394 37.4042C38.9154 46.8653 38.7913 56.3264 38.4687 66.0968C33.1579 68.8175 30.0063 70.3635 29.0137 70.7344V21.0791H29.1376Z" fill="#19191A"/>
</symbol>`;

const SVG_GRID = `<path d="M20 20V820M100 20V820M180 20V820M260 20V820M340 20V820M420 20V820M500 20V820M580 20V820M660 20V820M20 20H660M20 100H660M20 180H660M20 260H660M20 340H660M20 420H660M20 500H660M20 580H660M20 660H660M20 740H660M20 820H660" stroke="#1e1e2a" stroke-width="1" fill="none"/>`;

export const CANVAS_W = 680;
export const CANVAS_H = 840;
export const COLS = 8;
export const ROWS = 10;
export const CELL = 80;
export const PAD = 20;
export const GLYPH = 60;
export const BLOCK = 160;
export const BLOCK_GLYPH = 120;

export function glyphCount(d) {
  return [80, 40, 20, 10, 5, 4, 1, 1][d] ?? 0;
}

// 32-bit hash used for derivation; not byte-compatible with Solidity keccak256 but
// sufficient for the frontend's visual preview.
function h32(...args) {
  let x = 2166136261 >>> 0;
  for (const a of args) {
    const n = Number(a) >>> 0;
    x ^= n; x = Math.imul(x, 16777619) >>> 0;
    x ^= x >>> 13; x = Math.imul(x, 16777619) >>> 0;
  }
  return x;
}

export function deriveTraits(seed) {
  const h = h32(seed, 0xC0FFEE);
  return {
    colorBandIdx: h % 7,
    gradientIdx: (h >>> 3) % 7,
    direction: (h >>> 6) & 1,
    speed: 1 << ((h >>> 8) % 3),
  };
}

export function colorIndexFor(check, i) {
  const band = COLOR_BANDS[check.colorBandIdx ?? 0];
  const grad = GRADIENTS[check.gradientIdx ?? 0];
  const startIndex = h32(check.seed, 0xABCDEF) % 80;

  let nudge = 0;
  (check.merges || []).forEach(c => { if (c) nudge = h32(nudge, c); });

  let step;
  if (grad === 0) {
    step = h32(check.seed, i, 0xDEADBEEF) % band;
  } else {
    const checks = glyphCount(check.divisorIndex) || 1;
    step = Math.floor(i * grad * band / checks) % band;
  }
  if (check.direction === 1) step = (band - step) % band;

  return (startIndex + nudge + step) % 80;
}

function hexFor(check, i) {
  return EIGHTY_COLORS[colorIndexFor(check, i)];
}

function glyph(x, y, size, hex) {
  const half = size / 2;
  return (
    `<circle cx="${x + half}" cy="${y + half}" r="${half}" fill="#${hex}"/>` +
    `<use href="#m" x="${x}" y="${y}" width="${size}" height="${size}"/>`
  );
}

function renderCellGrid(check) {
  let cells = "", visibleIdx = 0;
  for (let row = 0; row < ROWS; ++row) {
    for (let col = 0; col < COLS; ++col) {
      if (check.divisorIndex === 1 && (col + row) % 2 !== 0) continue;
      const x = PAD + col * CELL + (CELL - GLYPH) / 2;
      const y = PAD + row * CELL + (CELL - GLYPH) / 2;
      cells += glyph(x, y, GLYPH, hexFor(check, visibleIdx));
      ++visibleIdx;
    }
  }
  return cells;
}

function renderBlockGrid(check) {
  let cells = "", visibleIdx = 0;
  const d = check.divisorIndex;

  if (d === 2) {
    for (let br = 0; br < 5; ++br) for (let bc = 0; bc < 4; ++bc) {
      const x = PAD + bc * BLOCK + 20;
      const y = PAD + br * BLOCK + 20;
      cells += glyph(x, y, BLOCK_GLYPH, hexFor(check, visibleIdx));
      ++visibleIdx;
    }
  } else if (d === 3) {
    for (let br = 0; br < 5; ++br) for (let bc = 1; bc <= 2; ++bc) {
      const x = PAD + bc * BLOCK + 20;
      const y = PAD + br * BLOCK + 20;
      cells += glyph(x, y, BLOCK_GLYPH, hexFor(check, visibleIdx));
      ++visibleIdx;
    }
  } else if (d === 4) {
    const x = (CANVAS_W - BLOCK_GLYPH) / 2;
    for (let br = 0; br < 5; ++br) cells += glyph(x, PAD + br * BLOCK + 20, BLOCK_GLYPH, hexFor(check, br));
  } else if (d === 5) {
    [[200,280],[360,280],[200,440],[360,440]].forEach(([x,y],i) => {
      cells += glyph(x, y, BLOCK_GLYPH, hexFor(check, i));
    });
  }
  return cells;
}

function renderMega(check) {
  const x = (CANVAS_W - BLOCK_GLYPH) / 2;
  const y = (CANVAS_H - BLOCK_GLYPH) / 2;
  return glyph(x, y, BLOCK_GLYPH, hexFor(check, 0));
}

function renderMegaDot() {
  // Dark canvas (same as every other divisor) + #DFD9D9 disc + black logomark.
  const x = (CANVAS_W - BLOCK_GLYPH) / 2;
  const y = (CANVAS_H - BLOCK_GLYPH) / 2;
  const half = BLOCK_GLYPH / 2;
  return (
    `<circle cx="${x + half}" cy="${y + half}" r="${half}" fill="#DFD9D9"/>` +
    `<use href="#m" x="${x}" y="${y}" width="${BLOCK_GLYPH}" height="${BLOCK_GLYPH}"/>`
  );
}

function normalise(checkOrSeed, d) {
  if (typeof checkOrSeed === "object" && checkOrSeed !== null) {
    const c = { ...checkOrSeed };
    if (c.colorBandIdx === undefined) {
      const t = deriveTraits(c.seed);
      c.colorBandIdx = t.colorBandIdx;
      c.gradientIdx = t.gradientIdx;
      c.direction = t.direction;
      c.speed = t.speed;
    }
    if (!c.merges) c.merges = [];
    if (c.isMega === undefined) c.isMega = c.divisorIndex >= 7 ? 1 : 0;
    return c;
  }
  const seed = (checkOrSeed >>> 0);
  const t = deriveTraits(seed);
  return {
    seed,
    divisorIndex: d | 0,
    merges: [],
    isMega: (d | 0) >= 7 ? 1 : 0,
    ...t,
  };
}

export function renderSVG(checkOrSeed, d) {
  const check = normalise(checkOrSeed, d);
  const isMega = check.divisorIndex >= 7 || check.isMega === 1;
  let inner;
  if (isMega) inner = renderMegaDot();
  else if (check.divisorIndex === 6) inner = renderMega(check);
  else if (check.divisorIndex >= 2) inner = renderBlockGrid(check);
  else inner = renderCellGrid(check);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CANVAS_W} ${CANVAS_H}" preserveAspectRatio="xMidYMid meet"><rect width="${CANVAS_W}" height="${CANVAS_H}" fill="#0a0a14"/>${SVG_GRID}<defs>${SYMBOL_M}</defs>${inner}</svg>`;
}

export function randomSeed() {
  return (Math.random() * 0xffffffff) >>> 0;
}
