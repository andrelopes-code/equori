import { ProblemError, errorText, fieldErrors } from "@/api/problem";
import type { TFunction } from "@/i18n/i18n-provider";

// A refused reimbursement names the rule on the allocation field; any other failure keeps the usual text.
export function reimbursementErrorText(error: unknown, t: TFunction): string {
  if (error instanceof ProblemError) {
    const fields = fieldErrors(error.problem);
    const key = Object.keys(fields).find((name) =>
      name.startsWith("allocations"),
    );
    if (key !== undefined) return fields[key] ?? errorText(error, t);
  }
  return errorText(error, t);
}
