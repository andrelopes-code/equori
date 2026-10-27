// A debt as typed: amounts in minor units and the monthly rate in percent, as text; account names
// the equori account whose balance filled the row, until the balance is edited.
export interface DebtRow {
  name: string;
  balance: string;
  rate: string;
  minimum: string;
  account: string | undefined;
}

export const maxDebts = 20;
const maxName = 40;
const minorPattern = /^\d{0,16}$/;
const ratePattern = /^(\d+(\.\d+)?)?$/;
const accountPattern = /^[0-9a-zA-Z-]{1,40}$/;

// The rows as one search value: fields joined by "~", rows by ";". The router keeps a value
// that is not JSON as text, where a JSON array would come back as an array.
export function encodeDebts(rows: readonly DebtRow[]): string {
  return rows
    .map((r) =>
      [
        r.name.replace(/[~;]/g, "").slice(0, maxName),
        r.balance,
        r.rate,
        r.minimum,
        ...(r.account === undefined ? [] : [r.account]),
      ].join("~"),
    )
    .join(";");
}

// Null when any row is invalid or there are more than 20: the rows are dropped together.
export function decodeDebts(text: string): DebtRow[] | null {
  const parts = text.split(";");
  if (parts.length > maxDebts) return null;
  const rows: DebtRow[] = [];
  for (const part of parts) {
    const [name = "", balance = "", rate = "", minimum = "", account, ...rest] =
      part.split("~");
    if (
      rest.length > 0 ||
      part.split("~").length < 4 ||
      name.length > maxName ||
      !minorPattern.test(balance) ||
      !ratePattern.test(rate) ||
      !minorPattern.test(minimum) ||
      (account !== undefined && !accountPattern.test(account))
    )
      return null;
    rows.push({ name, balance, rate, minimum, account });
  }
  return rows;
}
