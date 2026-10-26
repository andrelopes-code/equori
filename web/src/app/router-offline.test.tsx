import { screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { readDeviceUser, rememberDeviceUser } from "@/features/session";
import { catalogEn } from "@/i18n/catalog.en";
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

  it("keeps sending a signed-out visitor to the login page, asking once", async () => {
    let asked = 0;
    const { router } = await renderApp("/transactions", {
      fetch: fakeApi({
        "GET /api/v1/me": () => {
          asked += 1;
          return problem(401, "unauthorized");
        },
      }),
    });
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/login");
    });
    expect(asked).toBe(1);
  });

  it("opens /offline when the profile request gets no answer", async () => {
    rememberDeviceUser({ id: 7, email: "owner@equori.test" });
    const { router } = await renderApp("/transactions", {
      fetch: fakeApi({
        "GET /api/v1/me": () =>
          Promise.reject(new TypeError("Failed to fetch")),
      }),
    });
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/offline");
    });
    expect(
      await screen.findByRole("heading", { name: catalogEn["offline.title"] }),
    ).toBeInTheDocument();
  });
});
