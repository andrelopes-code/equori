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

const passphrase = "correct horse";

// A Field that is not required marks its label "(optional)".
const importPassphrase = new RegExp(`^${catalogEn["import.passphrase"]}`, "u");

interface Scenario {
  // The answer of the import, in order; the last one repeats.
  imports: Response[];
}

// The requests that reach the server, as text: the test environment's Request cannot parse its own form.
function api({ imports }: Scenario) {
  const exports: string[] = [];
  const uploads: string[] = [];
  let sent = 0;
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
      "GET /api/v1/transactions": () => json(200, { items: [] }),
      "GET /api/v1/exports/current": () => problem(404, "not_found"),
      "POST /api/v1/exports": async (req) => {
        exports.push(await req.text());
        return json(202, {
          id: "e1",
          status: "pending",
          requested_at: "2026-10-26T12:00:00Z",
        });
      },
      "POST /api/v1/imports/archive": async (req) => {
        uploads.push(await req.text());
        const answer = imports[Math.min(sent, imports.length - 1)];
        sent += 1;
        return answer?.clone() ?? json(500, {});
      },
    }),
  );
  return { fetch, exports, uploads };
}

function archiveImported(extra: Record<string, unknown>) {
  return json(200, {
    archive_version: 8,
    tables: [{ name: "ledger_account", rows: 4 }],
    credentials_in_archive: false,
    credentials_restored: 0,
    provider_keys_restored: 0,
    ...extra,
  });
}

function section() {
  return screen.getByRole("region", {
    name: catalogEn["settings.data.title"],
  });
}

async function choose(file = "equori-export-2026-10-26.zip") {
  const input = await within(section()).findByLabelText(
    catalogEn["import.choose"],
  );
  await userEvent.upload(
    input,
    new File(["zip"], file, { type: "application/zip" }),
  );
}

describe("Export with credentials", () => {
  it("sends the passphrase once both entries agree", async () => {
    const { fetch, exports } = api({ imports: [] });
    await renderApp("/settings?section=data", { fetch });
    await userEvent.click(
      await within(section()).findByRole("button", {
        name: catalogEn["export.withCredentials"],
      }),
    );
    const dialog = await screen.findByRole("dialog");
    const field = within(dialog).getByLabelText(
      catalogEn["export.credentials.passphrase"],
    );
    await userEvent.clear(field);
    await userEvent.type(field, passphrase);
    await userEvent.type(
      within(dialog).getByLabelText(catalogEn["export.credentials.confirm"]),
      "correct hors",
    );
    await userEvent.click(
      within(dialog).getByRole("button", { name: catalogEn["export.request"] }),
    );
    expect(
      await within(dialog).findByText(catalogEn["export.credentials.mismatch"]),
    ).toBeInTheDocument();
    expect(exports).toEqual([]);

    await userEvent.type(
      within(dialog).getByLabelText(catalogEn["export.credentials.confirm"]),
      "e",
    );
    await userEvent.click(
      within(dialog).getByRole("button", { name: catalogEn["export.request"] }),
    );
    await waitFor(() => {
      expect(exports).toHaveLength(1);
    });
    expect(JSON.parse(exports[0] ?? "")).toEqual({
      credentials_passphrase: passphrase,
    });
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
  });

  it("proposes a generated passphrase that needs the saved checkbox", async () => {
    const { fetch, exports } = api({ imports: [] });
    await renderApp("/settings?section=data", { fetch });
    await userEvent.click(
      await within(section()).findByRole("button", {
        name: catalogEn["export.withCredentials"],
      }),
    );
    const dialog = await screen.findByRole("dialog");
    const field = within(dialog).getByLabelText<HTMLInputElement>(
      catalogEn["export.credentials.passphrase"],
    );
    expect(field.type).toBe("text");
    expect(field.value).toMatch(/^([A-HJ-NP-Z2-9]{5}-){4}[A-HJ-NP-Z2-9]{5}$/u);
    expect(
      within(dialog).queryByLabelText(catalogEn["export.credentials.confirm"]),
    ).toBeNull();

    await userEvent.click(
      within(dialog).getByRole("button", { name: catalogEn["export.request"] }),
    );
    expect(
      await within(dialog).findByText(catalogEn["export.credentials.unsaved"]),
    ).toBeInTheDocument();
    expect(exports).toEqual([]);

    await userEvent.click(
      within(dialog).getByRole("checkbox", {
        name: catalogEn["export.credentials.saved"],
      }),
    );
    await userEvent.click(
      within(dialog).getByRole("button", { name: catalogEn["export.request"] }),
    );
    await waitFor(() => {
      expect(exports).toHaveLength(1);
    });
    expect(JSON.parse(exports[0] ?? "")).toEqual({
      credentials_passphrase: field.value,
    });
  });

  it("keeps the dialog usable where the browser has no clipboard", async () => {
    // A self-hosted instance served over plain HTTP has no navigator.clipboard, as jsdom has none.
    expect("clipboard" in window.navigator).toBe(false);
    const { fetch } = api({ imports: [] });
    await renderApp("/settings?section=data", { fetch });
    await userEvent.click(
      await within(section()).findByRole("button", {
        name: catalogEn["export.withCredentials"],
      }),
    );
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(
      within(dialog).getByRole("button", {
        name: catalogEn["export.credentials.copy"],
      }),
    );

    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("refuses a passphrase of fewer than 8 characters before the request", async () => {
    const { fetch, exports } = api({ imports: [] });
    await renderApp("/settings?section=data", { fetch });
    await userEvent.click(
      await within(section()).findByRole("button", {
        name: catalogEn["export.withCredentials"],
      }),
    );
    const dialog = await screen.findByRole("dialog");
    const field = within(dialog).getByLabelText(
      catalogEn["export.credentials.passphrase"],
    );
    await userEvent.clear(field);
    await userEvent.type(field, "short");
    await userEvent.type(
      within(dialog).getByLabelText(catalogEn["export.credentials.confirm"]),
      "short",
    );
    await userEvent.click(
      within(dialog).getByRole("button", { name: catalogEn["export.request"] }),
    );
    expect(
      await within(dialog).findByText(catalogEn["export.credentials.tooShort"]),
    ).toBeInTheDocument();
    expect(exports).toEqual([]);
  });
});

describe("Import with credentials", () => {
  it("sends the passphrase and reports the restored integrations", async () => {
    const { fetch, uploads } = api({
      imports: [
        archiveImported({
          credentials_in_archive: true,
          credentials_restored: 2,
        }),
      ],
    });
    await renderApp("/settings?section=data", { fetch });
    await userEvent.type(
      await within(section()).findByLabelText(importPassphrase),
      passphrase,
    );
    await choose();
    await waitFor(() => {
      expect(uploads).toHaveLength(1);
    });
    expect(uploads[0]).toMatch(/name="passphrase"\r\n\r\ncorrect horse\r\n/u);
    expect(
      await within(section()).findByText(
        "Archive imported: 4 rows, archive version 8. Integration credentials restored: 2.",
      ),
    ).toBeInTheDocument();
  });

  it("asks for the passphrase, then imports without credentials on request", async () => {
    const { fetch, uploads } = api({
      imports: [
        problem(422, "passphrase_required"),
        archiveImported({ credentials_in_archive: true }),
      ],
    });
    await renderApp("/settings?section=data", { fetch });
    await choose();
    expect(
      await within(section()).findByText(
        catalogEn["problem.passphrase_required"],
      ),
    ).toBeInTheDocument();
    expect(uploads[0]).not.toContain("skip_credentials");

    await userEvent.click(
      within(section()).getByRole("checkbox", {
        name: catalogEn["import.skipCredentials"],
      }),
    );
    await choose();
    await waitFor(() => {
      expect(uploads).toHaveLength(2);
    });
    expect(uploads[1]).toMatch(/name="skip_credentials"\r\n\r\ntrue\r\n/u);
    expect(
      await within(section()).findByText(
        `Archive imported: 4 rows, archive version 8. ${catalogEn["import.credentialsSkipped"]}`,
      ),
    ).toBeInTheDocument();
  });

  it("names a wrong passphrase", async () => {
    const { fetch } = api({ imports: [problem(422, "passphrase_invalid")] });
    await renderApp("/settings?section=data", { fetch });
    await userEvent.type(
      await within(section()).findByLabelText(importPassphrase),
      "wrong horse",
    );
    await choose();
    expect(
      await within(section()).findByText(
        catalogEn["problem.passphrase_invalid"],
      ),
    ).toBeInTheDocument();
  });

  it("keeps the plain import free of the credential fields", async () => {
    const { fetch, uploads } = api({ imports: [archiveImported({})] });
    await renderApp("/settings?section=data", { fetch });
    await choose();
    await waitFor(() => {
      expect(uploads).toHaveLength(1);
    });
    expect(uploads[0]).not.toContain('name="passphrase"');
    expect(uploads[0]).not.toContain("skip_credentials");
    expect(
      await within(section()).findByText(
        "Archive imported: 4 rows, archive version 8.",
      ),
    ).toBeInTheDocument();
  });
});
