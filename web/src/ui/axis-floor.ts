// Workaround for Slotted issue #70: a chart's value axis always holds zero, so a line far from
// zero draws flat. The axis starts a quarter of the values' span below the lowest value, rounded
// down to the span's order of magnitude, and never below zero; a negative or zero series keeps
// the chart's own axis.
export function axisFloor(values: readonly number[]): number | undefined {
  if (values.length === 0) return undefined;

  const low = Math.min(...values);
  const high = Math.max(...values);

  if (low < 0 || high === 0) return undefined;

  const span = high > low ? high - low : Math.abs(high) / 10;
  const step = 10 ** Math.floor(Math.log10(span));

  return Math.max(0, Math.floor((low - span / 4) / step) * step);
}
