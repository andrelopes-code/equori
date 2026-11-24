import { ProblemError } from "@/api/problem-error";
import type { Problem } from "@/api/problem-error";
import { catalogEn } from "@/i18n/catalog.en";
import type { MessageKey } from "@/i18n/catalog.en";
import type { TFunction } from "@/i18n/i18n-provider";

export { ProblemError, parseProblem, unwrap } from "@/api/problem-error";
export type { Problem } from "@/api/problem-error";

function isProblemKey(key: string): key is MessageKey {
  return key in catalogEn;
}

// The words of a problem code, or fallback when the catalog holds none.
export function codeText(code: string, fallback: string, t: TFunction): string {
  const key = `problem.${code}`;
  return isProblemKey(key) ? t(key) : fallback;
}

export function problemMessage(problem: Problem, t: TFunction): string {
  const missing = problem.missing_price;
  if (problem.code === "price_missing" && missing !== undefined)
    return t("problem.price_missing.named", {
      instrument: missing.instrument,
      quote: missing.quote_instrument,
    });

  return codeText(problem.code, problem.title, t);
}

export function fieldErrors(problem: Problem): Record<string, string> {
  const result: Record<string, string> = {};
  for (const error of problem.errors ?? []) {
    result[error.field] = error.message;
  }
  return result;
}

// A problem reads as its code's words; anything else is a request that never reached the server.
export function errorText(error: unknown, t: TFunction): string {
  return error instanceof ProblemError
    ? problemMessage(error.problem, t)
    : t("problem.transport");
}
