/**
 * DOCX table column width calculation
 *
 * Content-aware water-filling algorithm: measure max line width per cell,
 * derive per-column weights (avg/p90 blend), distribute total table width
 * with min/max constraints, then round to 0.1pt and convert to DXA.
 */

export const TOTAL_WIDTH_PT = 449.28; // 6.24 in × 72
export const MIN_WIDTH_PT = 64.8; // 0.9 in × 72
export const MAX_WIDTH_PT = 269.568; // 60% × TOTAL_WIDTH_PT
export const DXA_PER_PT = 20;

const MAX_ITER = 6;

/**
 * Measure the widest line in a cell (CJK chars count as 2, ASCII as 1).
 */
export function measureMaxLineWidth(text: string): number {
  if (!text) return 0;

  const lines = text.split('\n');
  let maxWidth = 0;

  for (const line of lines) {
    let lineWidth = 0;
    for (const ch of line) {
      const cp = ch.codePointAt(0) ?? 0;
      lineWidth += cp >= 0x1100 ? 2 : 1;
    }
    maxWidth = Math.max(maxWidth, lineWidth);
  }

  return maxWidth;
}

/**
 * Compute the 90th percentile of a numeric array.
 */
export function computeP90(values: number[]): number {
  if (values.length === 0) return 0;

  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(0.9 * (sorted.length - 1))];
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function equalColumnWidthsPt(numCols: number): number[] {
  const equalWidth = TOTAL_WIDTH_PT / numCols;
  return finalizeWidths(Array.from({ length: numCols }, () => equalWidth), false);
}

function finalizeWidths(widthsPt: number[], enforceBounds = true): number[] {
  const clamped = enforceBounds
    ? widthsPt.map((w) => clamp(w, MIN_WIDTH_PT, MAX_WIDTH_PT))
    : [...widthsPt];
  const rounded = clamped.map((w) => Math.round(w * 10) / 10);
  let error = TOTAL_WIDTH_PT - rounded.reduce((acc, w) => acc + w, 0);

  if (Math.abs(error) >= 0.001) {
    const indices = rounded
      .map((width, index) => ({ width, index }))
      .sort((a, b) => b.width - a.width)
      .map(({ index }) => index);

    for (const index of indices) {
      if (Math.abs(error) < 0.001) {
        break;
      }

      const candidate = rounded[index] + error;
      const adjusted = enforceBounds
        ? clamp(candidate, MIN_WIDTH_PT, MAX_WIDTH_PT)
        : candidate;
      const absorbed = adjusted - rounded[index];
      rounded[index] = Math.round(adjusted * 10) / 10;
      error -= absorbed;
    }
  }

  return rounded.map((pt) => Math.round(pt * DXA_PER_PT));
}

/**
 * Compute column widths in DXA (twentieths of a point) for a table cell matrix.
 * Rows should include header + data; empty strings for colspan cells are recommended.
 */
export function computeColumnWidthsDxa(cellMatrix: string[][]): number[] {
  if (cellMatrix.length === 0) return [];

  const numCols = Math.max(...cellMatrix.map((row) => row.length));
  if (numCols === 0) return [];

  if (numCols * MIN_WIDTH_PT > TOTAL_WIDTH_PT) {
    return equalColumnWidthsPt(numCols);
  }

  const weights: number[] = [];

  for (let col = 0; col < numCols; col++) {
    const colValues: number[] = [];
    for (const row of cellMatrix) {
      if (col < row.length) {
        colValues.push(measureMaxLineWidth(row[col]));
      }
    }

    if (colValues.length === 0) {
      weights.push(0);
      continue;
    }

    const avg = colValues.reduce((acc, v) => acc + v, 0) / colValues.length;
    const p90 = computeP90(colValues);
    weights.push(avg * 0.5 + p90 * 0.5);
  }

  const weightSum = weights.reduce((acc, w) => acc + w, 0);
  if (weightSum === 0) {
    return equalColumnWidthsPt(numCols);
  }

  let widths = weights.map((w) => (TOTAL_WIDTH_PT * w) / weightSum);

  for (let iter = 0; iter < MAX_ITER; iter++) {
    const clamped = widths.map((w) => clamp(w, MIN_WIDTH_PT, MAX_WIDTH_PT));
    const clampedSum = clamped.reduce((acc, w) => acc + w, 0);
    const residual = TOTAL_WIDTH_PT - clampedSum;

    if (Math.abs(residual) < 0.001) {
      widths = clamped;
      break;
    }

    const unclampedIndices: number[] = [];
    for (let i = 0; i < clamped.length; i++) {
      if (clamped[i] > MIN_WIDTH_PT && clamped[i] < MAX_WIDTH_PT) {
        unclampedIndices.push(i);
      }
    }

    if (unclampedIndices.length === 0) {
      widths = clamped;
      break;
    }

    const unclampedWeightSum = unclampedIndices.reduce((acc, i) => acc + weights[i], 0);
    const nextWidths = [...clamped];

    for (const i of unclampedIndices) {
      const share = unclampedWeightSum > 0
        ? (weights[i] / unclampedWeightSum) * residual
        : residual / unclampedIndices.length;
      nextWidths[i] = clamped[i] + share;
    }

    widths = nextWidths;
  }

  widths = widths.map((w) => clamp(w, MIN_WIDTH_PT, MAX_WIDTH_PT));
  return finalizeWidths(widths);
}
