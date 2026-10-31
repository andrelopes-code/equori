import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { reloadHome } from "@/features/session";
import { writeLocale } from "@/i18n/locale";
import { catalogPtBR as pt } from "@/i18n/catalog.pt-BR";
import { fakeApi, json } from "@/testing/fake-api";
import { renderApp } from "@/testing/render-app";

vi.mock("@/features/session/reload-home", () => ({ reloadHome: vi.fn() }));

const casa = { id: 4, name: "Casa", role: "owner", active: false };
const casal = { id: 12, name: "Casal", role: "write", active: true };

function api(items: unknown[], sent: unknown[]) {
  return fakeApi({
    "GET /api/v1/me": () =>
      json(200, {
        id: 1,
        email: "ana@example.com",
        role: "admin",
        language: "pt",
        region: "BR",
        books_id: 12,
        book_role: "write",
      }),
    "GET /api/v1/me/books": () => json(200, { items }),
    "PUT /api/v1/session/books": async (req) => {
      sent.push(await req.json());
      return new Response(null, { status: 204 });
    },
  });
}

async function openSheet(items: unknown[], sent: unknown[]) {
  await renderApp("/help", { width: 390, fetch: api(items, sent) });
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: pt["nav.more"] }));
  const sheet = await screen.findByRole("dialog");
  return { user, sheet: within(sheet), root: sheet };
}

describe("more sheet books", () => {
  beforeEach(() => {
    localStorage.clear();
    writeLocale({ language: "pt", region: "BR" });
    vi.mocked(reloadHome).mockClear();
  });

  it("names the active book and switches to another", async () => {
    const sent: unknown[] = [];
    const { user, sheet, root } = await openSheet([casa, casal], sent);

    await waitFor(() =>
      expect(root).toHaveTextContent("ana@example.com · Casal"),
    );
    await user.click(await sheet.findByRole("button", { name: "Casa" }));

    await waitFor(() => {
      expect(reloadHome).toHaveBeenCalledTimes(1);
    });
    expect(sent).toEqual([{ books_id: 4 }]);
  });

  it("offers a new book alone when there is one book", async () => {
    const sent: unknown[] = [];
    const { user, sheet, root } = await openSheet(
      [{ ...casa, active: true }],
      sent,
    );

    await sheet.findByRole("button", { name: pt["books.new"] });
    expect(root).toHaveTextContent("ana@example.com");
    expect(root).not.toHaveTextContent("·");
    expect(sheet.queryByRole("button", { name: "Casa" })).toBeNull();

    await user.click(sheet.getByRole("button", { name: pt["books.new"] }));

    expect(
      await screen.findByRole("heading", { name: pt["books.new"] }),
    ).toBeInTheDocument();
  });
});
