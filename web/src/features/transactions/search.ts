export interface TransactionSearch {
  account_id?: string;
  payee_id?: string;
  tag?: string;
  from?: string;
  to?: string;
  uncategorized?: true;
  q?: string;
}

// A search the page is about to write: an undefined key removes the filter.
export type TransactionSearchDraft = {
  [K in keyof TransactionSearch]?: TransactionSearch[K] | undefined;
};

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const datePattern = /^(\d{4})-(\d{2})-(\d{2})$/;
const maxQueryLength = 100;

function uuid(value: unknown): string | undefined {
  return typeof value === "string" && uuidPattern.test(value)
    ? value
    : undefined;
}

function isoDate(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const match = datePattern.exec(value);
  if (match === null) return undefined;
  const [year = 0, month = 0, day = 0] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
    ? value
    : undefined;
}

// The router parses a numeric-looking value from the URL into a number, so text accepts a finite number too.
function text(value: unknown, max: number): string | undefined {
  const raw =
    typeof value === "number" && Number.isFinite(value) ? String(value) : value;
  if (typeof raw !== "string") return undefined;
  const trimmed = raw.trim();
  return trimmed.length >= 1 && trimmed.length <= max ? trimmed : undefined;
}

// The capture screen opens a text of the offline queue by its id (P5 of ADR 022).
export function validateCaptureSearch(raw: Record<string, unknown>): {
  queued?: string;
} {
  const queued = uuid(raw.queued);
  return queued === undefined ? {} : { queued };
}

export function validateTransactionSearch(
  raw: Record<string, unknown>,
): TransactionSearch {
  const account_id = uuid(raw.account_id);
  const payee_id = uuid(raw.payee_id);
  const tag = text(raw.tag, Infinity);
  const from = isoDate(raw.from);
  const to = isoDate(raw.to);
  const q = text(raw.q, maxQueryLength);
  return {
    ...(account_id === undefined ? {} : { account_id }),
    ...(payee_id === undefined ? {} : { payee_id }),
    ...(tag === undefined ? {} : { tag }),
    ...(from === undefined ? {} : { from }),
    ...(to === undefined ? {} : { to }),
    ...(raw.uncategorized === true ? { uncategorized: true as const } : {}),
    ...(q === undefined ? {} : { q }),
  };
}

// A patch value that fails validation (empty text, undefined) removes the filter.
export function patchSearch(
  search: TransactionSearch,
  patch: Record<string, unknown>,
): TransactionSearch {
  return validateTransactionSearch({ ...search, ...patch });
}

const tokenPattern = /^[A-Za-z0-9-]{1,64}$/;

// The transactions page adds the selected row; the API never sees it.
export function validateTransactionsPageSearch(
  raw: Record<string, unknown>,
): TransactionSearch & { selected?: string } {
  const selected =
    typeof raw.selected === "string" && tokenPattern.test(raw.selected)
      ? raw.selected
      : undefined;
  return {
    ...validateTransactionSearch(raw),
    ...(selected === undefined ? {} : { selected }),
  };
}
