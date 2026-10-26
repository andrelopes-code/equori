import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { rememberDeviceUser } from "@/features/session";
import { readQueue } from "@/features/transactions/capture-queue";
import { catalogEn } from "@/i18n/catalog.en";
import { fakeApi } from "@/testing/fake-api";
import { renderApp } from "@/testing/render-app";

const offline = () =>
  fakeApi({
    "GET /api/v1/me": () => Promise.reject(new TypeError("Failed to fetch")),
  });

describe("OfflinePage", () => {
  beforeEach(() => {
    localStorage.clear();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("queues a text for the device's last user with the day it was written", async () => {
    rememberDeviceUser({ id: 7, email: "owner@equori.test" });
    await renderApp("/offline", { fetch: offline(), today: "2026-10-18" });
    expect(
      screen.getByText("Queued for owner@equori.test"),
    ).toBeInTheDocument();
    await userEvent.type(screen.getByRole("textbox"), "mercado 30 ontem");
    await userEvent.click(
      screen.getByRole("button", { name: catalogEn["offline.queue"] }),
    );
    expect(readQueue(7)).toMatchObject([
      { text: "mercado 30 ontem", capturedOn: "2026-10-18" },
    ]);
    expect(screen.getByRole("textbox")).toHaveValue("");
    expect(screen.getByText("mercado 30 ontem")).toBeInTheDocument();
  });

  it("discards an entry on request", async () => {
    rememberDeviceUser({ id: 7, email: "owner@equori.test" });
    await renderApp("/offline", { fetch: offline() });
    await userEvent.type(screen.getByRole("textbox"), "uber 12");
    await userEvent.click(
      screen.getByRole("button", { name: catalogEn["offline.queue"] }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: catalogEn["queue.discard"] }),
    );
    expect(readQueue(7)).toEqual([]);
    expect(screen.getByText(catalogEn["offline.empty"])).toBeInTheDocument();
  });

  it("keeps the text when the device refuses the write", async () => {
    rememberDeviceUser({ id: 7, email: "owner@equori.test" });
    await renderApp("/offline", { fetch: offline() });
    await userEvent.type(screen.getByRole("textbox"), "uber 12");
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("quota", "QuotaExceededError");
    });
    await userEvent.click(
      screen.getByRole("button", { name: catalogEn["offline.queue"] }),
    );
    expect(
      screen.getByText(catalogEn["offline.writeFailed"]),
    ).toBeInTheDocument();
    expect(screen.getByRole("textbox")).toHaveValue("uber 12");
  });

  it("offers no queue on a device nobody signed in on", async () => {
    await renderApp("/offline", { fetch: offline() });
    expect(screen.getByText(catalogEn["offline.noUser"])).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("tries the server again", async () => {
    rememberDeviceUser({ id: 7, email: "owner@equori.test" });
    const { router } = await renderApp("/offline", { fetch: offline() });
    await userEvent.click(
      screen.getByRole("button", { name: catalogEn["offline.retry"] }),
    );
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/offline");
    });
  });
});
