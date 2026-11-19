// The parts of the gross yield in the order of the bar: net, tax, and the redemption tax when
// there is one (spec 2026-11-19 RT5).
export function splitParts(
  answer: { net: number; tax: number; redemption: number },
  names: { net: string; tax: string; redemption: string },
  format: (minor: number) => string,
): { name: string; value: number; label: string }[] {
  const parts = [
    { name: names.net, value: answer.net },
    { name: names.tax, value: answer.tax },
    ...(answer.redemption > 0
      ? [{ name: names.redemption, value: answer.redemption }]
      : []),
  ];

  return parts.map((p) => ({ ...p, label: `${p.name} ${format(p.value)}` }));
}
