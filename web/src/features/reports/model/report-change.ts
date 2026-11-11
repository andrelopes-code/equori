// The change over the magnitude of its base, in basis points; undefined when the base is zero.
export function changeBP(change: number, base: number): number | undefined {
  return base === 0 ? undefined : Math.round((change * 10000) / Math.abs(base));
}
