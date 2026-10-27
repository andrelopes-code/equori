import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { catalogEn } from "@/i18n/catalog.en";
import { accountRoutes } from "@/testing/account-api";
import { fakeApi, json } from "@/testing/fake-api";
import { renderApp } from "@/testing/render-app";

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

const requested = "2026-10-26T12:00:00Z";

// A region other than BR and a base currency other than BRL.
function api({
  hasTransactions,
  tooNew = false,
}: {
  hasTransactions: boolean;
  // The import answers archive_too_new for an archive of version 3 (ADR 021).
  tooNew?: boolean;
}) {
  let status: "none" | "ready" = "none";
  const sent: string[] = [];
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
      "GET /api/v1/transactions": () =>
        json(200, {
          items: hasTransactions ? [{ id: "t" }] : [],
        }),
      "GET /api/v1/exports/current": () =>
        status === "none"
          ? json(404, {
              type: "about:blank",
              title: "Not Found",
              status: 404,
              code: "not_found",
            })
          : json(200, {
              id: "e1",
              status: "ready",
              requested_at: requested,
              finished_at: requested,
              size: 18_432,
              sha256: "ab",
              archive_version: 1,
            }),
      "POST /api/v1/exports": () => {
        sent.push("export");
        status = "ready";
        return json(202, {
          id: "e1",
          status: "pending",
          requested_at: requested,
        });
      },
      "POST /api/v1/imports/archive": async (req) => {
        // The multipart body read as text: the test environment's Request cannot parse its own form.
        const body = await req.text();
        sent.push(`import ${/name="(\w+)"/u.exec(body)?.[1] ?? "?"}`);
        if (tooNew)
          return json(422, {
            type: "about:blank",
            title: "Unprocessable Entity",
            status: 422,
            code: "archive_too_new",
            archive_version: 3,
            instance_version: 1,
          });
        return json(200, {
          archive_version: 1,
          tables: [
            { name: "ledger_account", rows: 14 },
            { name: "ledger_transaction", rows: 3 },
          ],
        });
      },
    }),
  );
  return { fetch, sent };
}

function section() {
  return screen.getByRole("region", {
    name: catalogEn["settings.data.title"],
  });
}

describe("Data section", () => {
  it("requests an export and offers the ready archive for download", async () => {
    const { fetch, sent } = api({ hasTransactions: true });
    await renderApp("/settings?section=data", { fetch });
    expect(
      await within(section()).findByText(catalogEn["export.none"]),
    ).toBeInTheDocument();
    await userEvent.click(
      within(section()).getByRole("button", {
        name: catalogEn["export.request"],
      }),
    );
    const download = await within(section()).findByRole("link", {
      name: catalogEn["export.download"],
    });
    expect(download).toHaveAttribute("href", "/api/v1/exports/current/content");
    expect(sent).toEqual(["export"]);
    expect(
      within(section()).getByText(
        /^Ready: 18 kB, requested on .*, archive version 1\.$/,
      ),
    ).toBeInTheDocument();
    expect(
      within(section()).getByText(catalogEn["import.blocked"]),
    ).toBeInTheDocument();
    expect(
      within(section()).queryByLabelText(catalogEn["import.choose"]),
    ).toBeNull();
  });

  it("imports an archive into books without transactions", async () => {
    const { fetch, sent } = api({ hasTransactions: false });
    await renderApp("/settings?section=data", { fetch });
    const input = await within(section()).findByLabelText(
      catalogEn["import.choose"],
    );
    await userEvent.upload(
      input,
      new File(["zip"], "equori-export-2026-10-26.zip", {
        type: "application/zip",
      }),
    );
    await waitFor(() => {
      expect(sent).toEqual(["import file"]);
    });
    expect(
      await within(section()).findByText(
        "Archive imported: 17 rows, archive version 1.",
      ),
    ).toBeInTheDocument();
  });

  it("names both versions of an archive written by a later version", async () => {
    const { fetch } = api({ hasTransactions: false, tooNew: true });
    await renderApp("/settings?section=data", { fetch });
    const input = await within(section()).findByLabelText(
      catalogEn["import.choose"],
    );
    await userEvent.upload(
      input,
      new File(["zip"], "equori-export-2027-01-01.zip", {
        type: "application/zip",
      }),
    );
    expect(
      await within(section()).findByText(
        "This archive has archive version 3; this version of equori imports up to archive version 1. Update equori to a version that imports archive version 3, then import again.",
      ),
    ).toBeInTheDocument();
  });
});
