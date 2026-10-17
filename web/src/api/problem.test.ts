import { describe, expect, it } from "vitest";

import {
  ProblemError,
  fieldErrors,
  parseProblem,
  problemMessage,
  unwrap,
} from "@/api/problem";
import type { Problem } from "@/api/problem";
import { catalogEn } from "@/i18n/catalog.en";
import type { TFunction } from "@/i18n/i18n-provider";

const t: TFunction = (key) => catalogEn[key];

const adrExample = {
  type: "about:blank",
  title: "Unprocessable Entity",
  status: 422,
  detail: "amount must not be zero",
  code: "invalid_transaction",
  request_id: "Q2N7...",
  errors: [{ field: "amount", message: "must not be zero" }],
};

describe("parseProblem", () => {
  it("returns the ADR 004 example body unchanged", () => {
    expect(parseProblem(422, adrExample)).toEqual(adrExample);
  });

  it("maps a non-problem 5xx body to internal_error", () => {
    expect(parseProblem(502, "<html>Bad Gateway</html>")).toEqual({
      type: "about:blank",
      title: "",
      status: 502,
      code: "internal_error",
    });
  });

  it("maps a non-problem 4xx body to invalid_request", () => {
    expect(parseProblem(400, undefined)).toEqual({
      type: "about:blank",
      title: "",
      status: 400,
      code: "invalid_request",
    });
  });

  it("rejects an object without a string code", () => {
    expect(parseProblem(409, { title: "Conflict", status: 409 }).code).toBe(
      "invalid_request",
    );
  });
});

describe("problemMessage", () => {
  const base: Problem = {
    type: "about:blank",
    title: "Conflict",
    status: 409,
    code: "version_conflict",
  };

  it("returns the catalog text for a known code", () => {
    expect(problemMessage(base, t)).toBe(catalogEn["problem.version_conflict"]);
  });

  it("returns the title for an unknown code", () => {
    expect(
      problemMessage({ ...base, title: "Teapot", code: "foo_bar" }, t),
    ).toBe("Teapot");
  });
});

describe("fieldErrors", () => {
  it("maps each field to its message", () => {
    expect(
      fieldErrors({
        ...parseProblem(422, adrExample),
        errors: [{ field: "amount", message: "must not be zero" }],
      }),
    ).toEqual({ amount: "must not be zero" });
  });

  it("returns an empty record without errors", () => {
    expect(fieldErrors(parseProblem(500, null))).toEqual({});
  });
});

describe("unwrap", () => {
  it("returns the data of a successful result", async () => {
    await expect(
      unwrap({
        data: { id: "a" },
        response: new Response(null, { status: 200 }),
      }),
    ).resolves.toEqual({ id: "a" });
  });

  it("throws a ProblemError carrying the problem and status", async () => {
    const error = await unwrap({
      error: adrExample,
      response: new Response(null, { status: 422 }),
    }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ProblemError);
    expect((error as ProblemError).status).toBe(422);
    expect((error as ProblemError).problem).toEqual(adrExample);
  });
});
