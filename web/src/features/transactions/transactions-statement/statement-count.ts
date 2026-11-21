type CountKey =
  | "transactions.statement.count.one"
  | "transactions.statement.count.other"
  | "transactions.statement.count.more";

// The catalog key of the row count: "N+" while more pages remain, else the locale's plural form.
export function statementCountKey(
  count: number,
  hasMore: boolean,
  locale: string,
): CountKey {
  if (hasMore) return "transactions.statement.count.more";

  if (new Intl.PluralRules(locale).select(count) === "one") {
    return "transactions.statement.count.one";
  }

  return "transactions.statement.count.other";
}
