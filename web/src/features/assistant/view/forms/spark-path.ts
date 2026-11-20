// The path of a sparkline in a 100 × 24 box: the series' range fills the height, 2 units of margin.
export function sparkPath(values: number[]): string {
  if (values.length === 0) return "";

  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const step = values.length > 1 ? 100 / (values.length - 1) : 0;

  return values
    .map((v, i) => {
      const y = 22 - ((v - lo) / (hi - lo || 1)) * 20;
      return `${i === 0 ? "M" : "L"}${(i * step).toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
}
