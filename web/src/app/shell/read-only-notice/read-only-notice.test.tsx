import { screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { writeLocale } from "@/i18n/locale";
import { catalogPtBR as pt } from "@/i18n/catalog.pt-BR";
import { fakeApi, json } from "@/testing/fake-api";
import { renderApp } from "@/testing/render-app";

function api(bookRole: string) {
  return fakeApi({
    "GET /api/v1/me": () =>
      json(200, {
        id: 1,
        email: "ana@example.com",
        role: "admin",
        language: "pt",
        region: "BR",
        books_id: 12,
        book_role: bookRole,
      }),
    "GET /api/v1/me/books": () => json(200, { items: [] }),
  });
}

describe("read-only notice", () => {
  beforeEach(() => {
    localStorage.clear();
    writeLocale({ language: "pt", region: "BR" });
  });

  it.each([
    { bookRole: "read", shown: true },
    { bookRole: "write", shown: false },
    { bookRole: "owner", shown: false },
  ])("book role $bookRole shows the notice: $shown", async (row) => {
    await renderApp("/help", { fetch: api(row.bookRole) });
    // The account trigger renders after /me resolves.
    await screen.findByRole("button", { name: pt["nav.user"] });

    if (row.shown) {
      expect(await screen.findByText(pt["shell.readOnly"])).toBeInTheDocument();
      return;
    }
    await waitFor(() => {
      expect(screen.queryByText(pt["shell.readOnly"])).toBeNull();
    });
  });
});
