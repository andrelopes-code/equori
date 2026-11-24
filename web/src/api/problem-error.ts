import type { components } from "@/api/schema.gen";

export type Problem = components["schemas"]["Problem"];

export class ProblemError extends Error {
  readonly problem: Problem;
  readonly status: number;

  constructor(problem: Problem) {
    super(problem.detail ?? problem.title);
    this.name = "ProblemError";
    this.problem = problem;
    this.status = problem.status;
  }
}

function isProblem(body: unknown): body is Problem {
  if (typeof body !== "object" || body === null) return false;
  const candidate = body as Record<string, unknown>;
  return (
    typeof candidate.code === "string" &&
    typeof candidate.title === "string" &&
    typeof candidate.status === "number"
  );
}

export function parseProblem(status: number, body: unknown): Problem {
  if (isProblem(body)) return body;
  return {
    type: "about:blank",
    title: "",
    status,
    code: status >= 500 ? "internal_error" : "invalid_request",
  };
}

// A fetch rejection (TypeError) is not wrapped: it propagates and the query client retries it.
export function unwrap<T>(result: {
  data?: T;
  error?: unknown;
  response: Response;
}): Promise<T> {
  if (result.error !== undefined) {
    return Promise.reject(
      new ProblemError(parseProblem(result.response.status, result.error)),
    );
  }
  return Promise.resolve(result.data as T);
}
