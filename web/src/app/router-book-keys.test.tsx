import { screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { catalogEn } from "@/i18n/catalog.en";
import { fakeApi, json, problem } from "@/testing/fake-api";
import { renderApp } from "@/testing/render-app";

const me = {
  id: 7,
  email: "owner@equori.test",
  role: "member",
  language: "en",
  region: "US",
  books_id: 9,
  book_role: "write",
};

describe("browser keys of the first load", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("equori.recent-categories", '["c1"]');
  });

  it("moves the unsuffixed keys under the lowest owner book", async () => {
    await renderApp("/help", {
      fetch: fakeApi({
        "GET /api/v1/me": () => json(200, me),
        "GET /api/v1/me/books": () =>
          json(200, {
            items: [
              { id: 4, name: "Casa", role: "owner", active: false },
              { id: 9, name: "Casal", role: "write", active: true },
            ],
          }),
      }),
    });

    await waitFor(() => {
      expect(localStorage.getItem("equori.recent-categories.4")).toBe('["c1"]');
    });
    expect(localStorage.getItem("equori.recent-categories")).toBeNull();
  });

  it("leaves the keys for the next load when the list fails", async () => {
    await renderApp("/help", {
      fetch: fakeApi({
        "GET /api/v1/me": () => json(200, me),
        "GET /api/v1/me/books": () => problem(500, "internal_error"),
      }),
    });

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: catalogEn["help.title"],
      }),
    ).toBeInTheDocument();
    expect(localStorage.getItem("equori.recent-categories")).toBe('["c1"]');
  });
});
