// Rounds to the nearest integer, a tie to the even one (calculators design §3): every amount a
// method returns is an integer of minor units.
export function roundHalfEven(x: number): number {
  const floor = Math.floor(x);
  const rest = x - floor;
  const r = rest > 0.5 || (rest === 0.5 && floor % 2 !== 0) ? floor + 1 : floor;
  return r === 0 ? 0 : r;
}
