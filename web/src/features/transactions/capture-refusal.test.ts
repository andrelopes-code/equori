import { describe, expect, it } from "vitest";

import { ProblemError } from "@/api/problem";
import { refusalOf } from "@/features/transactions/capture-refusal";

const rows = [{ line: { line: 1 } }, { line: { line: 3 } }];

describe("refusalOf", () => {
  it("names the refused entry by the line of its row", () => {
    const error = refused("entries[1].transaction.amount", "too large");

    expect(refusalOf(error, rows)).toEqual({
      index: 1,
      line: 3,
      message: "too large",
    });
  });

  it("counts lines from one for an entry without a row", () => {
    const error = refused("entries[4]", "unknown account");

    expect(refusalOf(error, rows)).toEqual({
      index: 4,
      line: 5,
      message: "unknown account",
    });
  });

  it("returns undefined for a field outside the entries", () => {
    expect(refusalOf(refused("currency", "bad"), rows)).toBeUndefined();
  });

  it("returns undefined for an error without a problem", () => {
    expect(refusalOf(new Error("offline"), rows)).toBeUndefined();
  });
});

function refused(field: string, message: string): ProblemError {
  return new ProblemError({
    type: "about:blank",
    title: "Unprocessable",
    status: 422,
    code: "validation_failed",
    errors: [{ field, message }],
  });
}
