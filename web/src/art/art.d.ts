export interface DotCheck {
  seed: number;
  divisorIndex: number;
  merges?: number[];
  isMega?: number;
  colorBandIdx?: number;
  gradientIdx?: number;
  direction?: number;
  speed?: number;
}

export function renderSVG(checkOrSeed: DotCheck | number, d?: number): string;
export function randomSeed(): number;
export function glyphCount(d: number): number;
export function deriveTraits(seed: number): {
  colorBandIdx: number;
  gradientIdx: number;
  direction: number;
  speed: number;
};
export function colorIndexFor(check: DotCheck, i: number): number;

export const CANVAS_W: number;
export const CANVAS_H: number;
export const COLS: number;
export const ROWS: number;
export const CELL: number;
export const PAD: number;
export const GLYPH: number;
export const BLOCK: number;
export const BLOCK_GLYPH: number;
