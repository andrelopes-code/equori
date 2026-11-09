const symbolPattern = /^[A-Za-z0-9.=^_-]{1,40}$/;

// Returns the set to send, absent when the draft equals the stored set, and the sources whose
// value fails the pattern of the contract.
export function symbolsEdit(
  stored: Record<string, string> | undefined,
  draft: Record<string, string>,
): { symbols?: Record<string, string>; invalid: string[] } {
  const values: Record<string, string> = {};
  const invalid: string[] = [];
  for (const [source, raw] of Object.entries(draft)) {
    const value = raw.trim();
    if (value === "") continue;
    if (symbolPattern.test(value)) values[source] = value;
    else invalid.push(source);
  }
  invalid.sort();

  if (invalid.length > 0) return { invalid };

  const before = stored ?? {};
  const keys = Object.keys(values);
  const same =
    keys.length === Object.keys(before).length &&
    keys.every((k) => before[k] === values[k]);

  return same ? { invalid } : { symbols: values, invalid };
}
