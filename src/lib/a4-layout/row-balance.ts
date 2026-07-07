/** Spread metrics for estimated card heights inside one row. */
export function rowHeightSpread(heights: number[]) {
  const minH = Math.min(...heights);
  const maxH = Math.max(...heights);
  return {
    minH,
    maxH,
    spread: maxH - minH,
    ratio: minH > 0 ? maxH / minH : Number.POSITIVE_INFINITY,
  };
}

/**
 * Rejects row candidates where cards would share a row but need very different heights.
 * Semantic sequences (same section + entityType) get slightly more tolerance.
 */
export function isAcceptableRowHeightBalance(heights: number[], opts: { semantic?: boolean } = {}): boolean {
  if (heights.length < 2) return true;

  const { minH, maxH, spread, ratio } = rowHeightSpread(heights);
  if (spread <= 22) return true;

  const maxSpread = opts.semantic ? 54 : 40;
  const maxRatio = opts.semantic ? 1.5 : 1.36;

  const rowHeight = maxH;
  const empty = heights.reduce((sum, h) => sum + Math.max(0, rowHeight - h), 0);
  const emptyRatio = empty / Math.max(1, rowHeight * heights.length);
  const maxEmptyRatio = opts.semantic ? 0.44 : 0.34;

  if (emptyRatio > maxEmptyRatio) return false;
  if (spread > maxSpread && ratio > maxRatio) return false;
  if (ratio > maxRatio + 0.06) return false;

  return true;
}
