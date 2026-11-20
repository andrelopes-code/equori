// An amount in minor units rounded half away from zero to whole units of its currency, with
// integer arithmetic only (O7).
export function wholeUnits(minor: number, scale: number): number {
  const unit = 10 ** scale;
  const whole = Math.trunc(minor / unit);
  const rest = Math.abs(minor % unit);

  return rest * 2 >= unit ? whole + Math.sign(minor) : whole;
}
