import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { catalogEn } from "@/i18n/catalog.en";
import { accountRoutes } from "@/testing/account-api";
import { fakeApi, json, problem } from "@/testing/fake-api";
import { renderApp } from "@/testing/render-app";

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

const name = "Home";

// The requests that reach the server, as text: the test environment's Request cannot parse its own form.
function api(answer: Response) {
  const uploads: string[] = [];
  const fetch = fakeApi(
    accountRoutes({
      "GET /api/v1/me": () =>
        json(200, {
          id: 1,
          email: "a@b.c",
          role: "admin",
          language: "en",
          region: "DE",
        }),
      "GET /api/v1/settings": () => json(200, { base_currency: "EUR" }),
      "GET /api/v1/books/current": () =>
        json(200, { name, region: "DE", base_currency: "EUR" }),
      "GET /api/v1/transactions": () => json(200, { items: [{ id: "t" }] }),
      "GET /api/v1/exports/current": () => problem(404, "not_found"),
      "POST /api/v1/imports/archive": async (req) => {
        uploads.push(await req.text());
        return answer.clone();
      },
    }),
  );
  return { fetch, uploads };
}

function section() {
  return screen.getByRole("region", {
    name: catalogEn["settings.data.title"],
  });
}

// Opens the dialog of a book with transactions and types text as the book name.
async function openAndType(text: string) {
  await userEvent.click(
    await within(section()).findByRole("button", {
      name: catalogEn["import.replace"],
    }),
  );
  const dialog = await screen.findByRole("dialog");
  const choose = within(dialog).getByRole("button", {
    name: catalogEn["import.choose"],
  });
  expect(choose).toBeDisabled();

  await userEvent.type(
    within(dialog).getByLabelText(catalogEn["import.replace.confirm"]),
    text,
  );
  await userEvent.upload(
    within(dialog).getByLabelText(catalogEn["import.choose"]),
    new File(["zip"], "equori-export-2026-11-09.zip", {
      type: "application/zip",
    }),
  );

  return dialog;
}

describe("Replace content", () => {
  it("sends the book name with the archive and reports the import", async () => {
    const { fetch, uploads } = api(
      json(200, {
        archive_version: 9,
        tables: [{ name: "ledger_account", rows: 4 }],
        credentials_in_archive: false,
        credentials_restored: 0,
        provider_keys_restored: 0,
      }),
    );
    await renderApp("/settings?section=data", { fetch });

    await openAndType(name);

    await waitFor(() => {
      expect(uploads).toHaveLength(1);
    });
    expect(uploads[0]).toMatch(/name="replace_books_name"\r\n\r\nHome\r\n/u);
    expect(
      await within(section()).findByText(
        "Archive imported: 4 rows, archive version 9.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("keeps the dialog open with the refusal of the server", async () => {
    const { fetch } = api(problem(422, "confirmation_mismatch"));
    await renderApp("/settings?section=data", { fetch });

    const dialog = await openAndType(name);

    expect(
      await within(dialog).findByText(
        catalogEn["problem.confirmation_mismatch"],
      ),
    ).toBeInTheDocument();
  });

  it("keeps the archive choice disabled until the name matches", async () => {
    const { fetch, uploads } = api(problem(500, "internal_error"));
    await renderApp("/settings?section=data", { fetch });

    const dialog = await openAndType("Hom");

    expect(
      within(dialog).getByRole("button", { name: catalogEn["import.choose"] }),
    ).toBeDisabled();
    expect(uploads).toEqual([]);
  });
});
