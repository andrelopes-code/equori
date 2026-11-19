// The seven address keys of a rate that may follow an index: the rate, its period, the index, and
// how the rate follows it (form, percent, spread, basis).
export function rateSourceKeys<P extends string>(prefix: P) {
  return [
    prefix,
    `${prefix}Period`,
    `${prefix}Index`,
    `${prefix}Form`,
    `${prefix}Percent`,
    `${prefix}Spread`,
    `${prefix}Basis`,
  ] as const;
}
