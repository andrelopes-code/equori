import { waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { readDeviceUser } from "@/features/session";
import { fakeApi, json, problem } from "@/testing/fake-api";
import { renderApp } from "@/testing/render-app";
import { sharedRoutes } from "@/testing/transaction-api";

describe("offline redirect", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("stores the last user of the device on an authenticated load", async () => {
    await renderApp("/transactions/capture", {
      fetch: fakeApi({
        ...sharedRoutes,
        "GET /api/v1/me": () =>
          json(200, {
            id: 7,
            email: "owner@equori.test",
            role: "admin",
            language: "en",
            region: "US",
          }),
      }),
    });
    await waitFor(() => {
      expect(readDeviceUser()).toEqual({ id: 7, email: "owner@equori.test" });
    });
  });

  it("keeps sending a signed-out visitor to the login page", async () => {
    const { router } = await renderApp("/transactions", {
      fetch: fakeApi({
        "GET /api/v1/me": () => problem(401, "unauthorized"),
      }),
    });
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/login");
    });
  });
});
