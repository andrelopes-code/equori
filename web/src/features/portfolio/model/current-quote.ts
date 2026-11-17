export interface CurrentQuote {
  at: string;
  open: boolean;
}

// The current quote of a value: the earliest instant among its prices, open when any is open.
export function currentQuoteOf(
  prices: readonly { at?: string; open?: boolean }[] | undefined,
): CurrentQuote | undefined {
  const quoted = prices?.filter((p) => p.at !== undefined) ?? [];
  const at = quoted
    .flatMap((p) => (p.at === undefined ? [] : [p.at]))
    .sort()[0];
  if (at === undefined) return undefined;

  return { at, open: quoted.some((p) => p.open === true) };
}
