import { ProblemError, fieldErrors } from "@/api/problem";

const refusedEntry = /^entries\[(\d+)\]/;

export interface CaptureRefusal {
  index: number;
  line: number;
  message: string;
}

// The entry the server refused, read from the first field error of its problem; undefined
// for any other failure.
export function refusalOf(
  error: unknown,
  rows: readonly { line: { line: number } }[],
): CaptureRefusal | undefined {
  if (!(error instanceof ProblemError)) return undefined;

  const [field, message] = Object.entries(fieldErrors(error.problem))[0] ?? [];
  const index = field === undefined ? undefined : refusedEntry.exec(field)?.[1];
  if (index === undefined || message === undefined) return undefined;

  return {
    index: Number(index),
    line: rows[Number(index)]?.line.line ?? Number(index) + 1,
    message,
  };
}
