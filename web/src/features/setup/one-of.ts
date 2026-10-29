// Narrows a value a control reports to the closed set the control was drawn from.
export function oneOf<T extends string>(
  values: readonly T[],
  value: string,
): value is T {
  return (values as readonly string[]).includes(value);
}
