import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { reloadHome } from "@/features/session";
import { DeleteBooksDialog } from "@/features/setup/delete-books-dialog";
import { catalogPtBR as pt } from "@/i18n/catalog.pt-BR";
import { fakeApi, json, problem } from "@/testing/fake-api";
import { renderWithProviders } from "@/testing/render-app";

vi.mock("@/features/session/reload-home", () => ({ reloadHome: vi.fn() }));

function api(bodies: unknown[], answer: () => Response) {
  return fakeApi({
    "GET /api/v1/me": () =>
      json(200, { id: 1, email: "a@b.c", language: "pt", region: "BR" }),
    "GET /api/v1/books/current": () =>
      json(200, {
        name: "Casal",
        region: "BR",
        time_zone: null,
        default_time_zone: "America/Sao_Paulo",
      }),
    "DELETE /api/v1/books/current": async (req: Request) => {
      bodies.push(await req.json());
      return answer();
    },
  });
}

describe("DeleteBooksDialog", () => {
  beforeEach(() => {
    vi.mocked(reloadHome).mockClear();
  });

  it("asks the book name and deletes only once it is typed", async () => {
    const bodies: unknown[] = [];
    renderWithProviders(<DeleteBooksDialog onClose={() => undefined} />, {
      fetch: api(bodies, () => new Response(null, { status: 204 })),
    });

    const button = await screen.findByRole("button", {
      name: pt["books.delete"],
    });
    expect(button).toBeDisabled();

    await userEvent.type(
      screen.getByRole("textbox", { name: pt["books.delete.confirm"] }),
      "Casa",
    );
    expect(button).toBeDisabled();

    await userEvent.type(
      screen.getByRole("textbox", { name: pt["books.delete.confirm"] }),
      "l",
    );
    await userEvent.click(button);

    await waitFor(() => {
      expect(reloadHome).toHaveBeenCalledTimes(1);
    });
    expect(bodies).toEqual([{ name: "Casal" }]);
  });

  it("shows the refusal of the server and stays open", async () => {
    renderWithProviders(<DeleteBooksDialog onClose={() => undefined} />, {
      fetch: api([], () => problem(409, "books_has_members")),
    });

    await userEvent.type(
      await screen.findByRole("textbox", { name: pt["books.delete.confirm"] }),
      "Casal",
    );
    await userEvent.click(
      screen.getByRole("button", { name: pt["books.delete"] }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      pt["problem.books_has_members"],
    );
    expect(reloadHome).not.toHaveBeenCalled();
  });
});
