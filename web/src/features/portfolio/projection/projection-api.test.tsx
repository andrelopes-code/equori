import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import createClient from "openapi-fetch";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";

import { ApiProvider } from "@/api/api-context";
import { ProblemError } from "@/api/problem";
import type { paths } from "@/api/schema.gen";
import {
  projectionQuery,
  useDeleteProjection,
  useSaveProjection,
} from "@/features/portfolio/api";
import { json, problem } from "@/testing/fake-api";
import { portfolioApi, projectionPlan } from "@/testing/portfolio-api";

describe("projectionQuery", () => {
  it("reads the plan of the member", async () => {
    const plan = await newQueries().query(projectionQuery(newClient()));

    expect(plan).toEqual(projectionPlan);
  });

  it("reads a 404 as no plan", async () => {
    const client = newClient({
      "GET /api/v1/portfolio-projection": () => problem(404, "not_found"),
    });

    expect(await newQueries().query(projectionQuery(client))).toBeNull();
  });

  it("rejects any other failure", async () => {
    const client = newClient({
      "GET /api/v1/portfolio-projection": () => problem(500, "internal_error"),
    });

    await expect(
      newQueries().query(projectionQuery(client)),
    ).rejects.toBeInstanceOf(ProblemError);
  });
});

describe("useSaveProjection", () => {
  it("puts the plan and returns the stored one", async () => {
    const bodies: unknown[] = [];
    const client = newClient({
      "PUT /api/v1/portfolio-projection": async (req) => {
        bodies.push(await req.json());

        return json(200, projectionPlan);
      },
    });
    const { result } = renderHook(() => useSaveProjection(), {
      wrapper: wrapperOf(client),
    });
    const input = {
      withdrawal_age: projectionPlan.withdrawal_age,
      last_age: projectionPlan.last_age,
      real_return_bp: projectionPlan.real_return_bp,
      inflation_bp: projectionPlan.inflation_bp,
      withdrawal: projectionPlan.withdrawal,
      changes: projectionPlan.changes,
    };

    const saved = await result.current.mutateAsync(input);

    expect(bodies).toEqual([input]);
    expect(saved).toEqual(projectionPlan);
  });

  it("rejects a 422 with its problem", async () => {
    const client = newClient({
      "PUT /api/v1/portfolio-projection": () =>
        problem(422, "projection_past_change"),
    });
    const { result } = renderHook(() => useSaveProjection(), {
      wrapper: wrapperOf(client),
    });

    await expect(
      result.current.mutateAsync({ ...projectionPlan, changes: [] }),
    ).rejects.toMatchObject({ status: 422 });
  });
});

describe("useDeleteProjection", () => {
  it("deletes the plan", async () => {
    const { result } = renderHook(() => useDeleteProjection(), {
      wrapper: wrapperOf(newClient()),
    });

    await expect(result.current.mutateAsync()).resolves.toBeUndefined();
  });
});

function newClient(routes: Parameters<typeof portfolioApi>[0] = {}) {
  return createClient<paths>({
    baseUrl: "http://localhost/api/v1",
    fetch: portfolioApi(routes),
  });
}

function newQueries() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function wrapperOf(client: ReturnType<typeof newClient>) {
  const queries = newQueries();

  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queries}>
        <ApiProvider client={client}>{children}</ApiProvider>
      </QueryClientProvider>
    );
  };
}
