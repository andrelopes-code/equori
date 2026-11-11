export interface StatementSearch {
  // The payment form stands open over the statement (FM-12).
  pay?: true;
}

export function validateStatementSearch(
  raw: Record<string, unknown>,
): StatementSearch {
  return raw.pay === true ? { pay: true } : {};
}
