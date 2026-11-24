import {
  onlineManager,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import createClient from "openapi-fetch";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it } from "vitest";

import { ApiProvider } from "@/api/api-context";
import type { paths } from "@/api/schema.gen";
import { useIndexList } from "@/features/calculators/rate-source/use-index-rate";
import { calculatorApiRoutes, cdiFixture } from "@/testing/calculator-api";
import { fakeApi } from "@/testing/fake-api";

describe("useIndexList", () => {
  afterEach(() => {
    onlineManager.setOnline(true);
  });

  it("reads a read paused offline as held, not as loading", async () => {
    onlineManager.setOnline(false);

    const { result } = renderHook(() => useIndexList(), { wrapper });

    await waitFor(() => {
      expect(result.current.paused).toBe(true);
    });
    expect(result.current.pending).toBe(true);
  });

  it("is not paused online", () => {
    const { result } = renderHook(() => useIndexList(), { wrapper });

    expect(result.current.paused).toBe(false);
  });

  it("leaves out the index of a market, which no contract pays", async () => {
    const { result } = renderHook(() => useIndexList(), { wrapper });

    await waitFor(() => {
      expect(result.current.indexes.map((x) => x.id)).toEqual(["cdi"]);
    });
  });
});

function wrapper({ children }: { children: ReactNode }) {
  const queries = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const client = createClient<paths>({
    baseUrl: "http://localhost/api/v1",
    fetch: fakeApi(
      calculatorApiRoutes([
        cdiFixture(),
        {
          id: "ibovespa",
          period: "day",
          kind: "market",
          rates: [{ date: "2026-10-16", rate: "0.01" }],
        },
      ]),
    ),
  });

  return (
    <QueryClientProvider client={queries}>
      <ApiProvider client={client}>{children}</ApiProvider>
    </QueryClientProvider>
  );
}
