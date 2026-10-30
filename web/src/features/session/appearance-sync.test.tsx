import { act, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fakeApi, json, problem } from "@/testing/fake-api";
import { renderWithProviders } from "@/testing/render-app";
import { applyScheme, readScheme } from "@/theme/scheme";

const me = {
  id: 7,
  email: "a@b.c",
  role: "admin",
  language: "en",
  region: "US",
};

function api(server: Record<string, string>, puts: unknown[], signedIn = true) {
  return fakeApi({
    "GET /api/v1/me": () =>
      signedIn ? json(200, me) : problem(401, "unauthorized"),
    "GET /api/v1/me/appearance": () => json(200, server),
    "PUT /api/v1/me/appearance": async (req: Request) => {
      puts.push(await req.json());
      return json(200, {});
    },
  });
}

describe("AppearanceSync", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("replaces the browser copy with the server object", async () => {
    const puts: unknown[] = [];
    applyScheme("dark");
    renderWithProviders(<div />, {
      fetch: api({ scheme: "light" }, puts),
    });

    await waitFor(() => {
      expect(readScheme()).toBe("light");
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    expect(puts).toEqual([]);
  });

  it("sends the browser copy when the server object is empty", async () => {
    const puts: unknown[] = [];
    applyScheme("light");
    renderWithProviders(<div />, { fetch: api({}, puts) });

    await waitFor(() => {
      expect(puts).toEqual([{ scheme: "light" }]);
    });
  });

  it("saves a later change once, 300 ms after the last one", async () => {
    const puts: unknown[] = [];
    renderWithProviders(<div />, {
      fetch: api({ scheme: "light" }, puts),
    });
    await waitFor(() => {
      expect(readScheme()).toBe("light");
    });

    act(() => {
      applyScheme("dark");
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(299);
    });
    expect(puts).toEqual([]);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });

    await waitFor(() => {
      expect(puts).toHaveLength(1);
    });
    expect(puts[0]).toMatchObject({ scheme: "dark" });
  });

  it("requests nothing without a session", async () => {
    const puts: unknown[] = [];
    const fetch = api({}, puts, false);
    renderWithProviders(<div />, { fetch });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    expect(fetch.calls).not.toContain("GET /api/v1/me/appearance");
    expect(puts).toEqual([]);
  });
});
