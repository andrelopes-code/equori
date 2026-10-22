import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { catalogEn } from "@/i18n/catalog.en";
import { accountRoutes, checkingID } from "@/testing/account-api";
import { fakeApi, json, problem } from "@/testing/fake-api";
import { renderApp } from "@/testing/render-app";

type Route = (req: Request) => Response | Promise<Response>;

const csv =
  "Data;Descrição;Valor\n05/10/2026;Padaria;-12,50\n06/10/2026;Salário;5.000,00\n";
const saved = {
  delimiter: "semicolon",
  header_rows: 1,
  date_column: "Data",
  date_layout: "DD/MM/YYYY",
  amount_column: "Valor",
  decimal_separator: ",",
  description_column: "Descrição",
  amount_sign: "as_is",
};

function batch(id: string) {
  return {
    id,
    account_id: checkingID,
    source: "csv",
    file_name: "extrato.csv",
    counts: {
      received: 2,
      ignored: 0,
      matched: 0,
      created: 2,
      needs_review: 0,
      discarded: 0,
      updated: 0,
      withdrawn: 0,
    },
    balance: { status: "none" },
    started_at: "2026-10-17T12:00:00Z",
  };
}

const profiles: unknown[] = [];

function api(log: string[], overrides: Record<string, Route> = {}) {
  profiles.length = 0;
  return fakeApi(
    accountRoutes({
      [`GET /api/v1/accounts/${checkingID}/csv-profile`]: () =>
        problem(404, "not_found"),
      [`PUT /api/v1/accounts/${checkingID}/csv-profile`]: async (req) => {
        log.push("PUT");
        profiles.push(await req.json());
        return json(200, saved);
      },
      [`POST /api/v1/accounts/${checkingID}/imports`]: async (req) => {
        // The multipart body read as text: the test environment's Request cannot parse its own form.
        const body = await req.text();
        log.push(
          `POST ${/name="format"\r\n\r\n(\w+)/u.exec(body)?.[1] ?? "?"}`,
        );
        return json(201, batch("b9"));
      },
      [`GET /api/v1/import-batches/b9`]: () => json(200, batch("b9")),
      [`GET /api/v1/import-batches/b9/records`]: () => json(200, { items: [] }),
      ...overrides,
    }),
  );
}

async function choose(file: File) {
  const input = await waitFor(() => {
    const found = document.querySelector<HTMLInputElement>(
      '[data-ui="upload"] input[type="file"]',
    );
    if (found === null) throw new Error("no file input yet");
    return found;
  });
  await userEvent.upload(input, file);
}

function importButton() {
  return screen.getByRole("button", { name: catalogEn["importFile.submit"] });
}

describe("Import statement", () => {
  it("reads a CSV's columns into a profile and previews the lines before sending", async () => {
    const log: string[] = [];
    const { router } = await renderApp(`/accounts/${checkingID}/import`, {
      fetch: api(log),
    });
    await choose(new File([csv], "extrato.csv", { type: "text/csv" }));
    const preview = await screen.findByRole("table", {
      name: catalogEn["importFile.preview"],
    });
    expect(preview).toHaveTextContent("Padaria");
    expect(preview).toHaveTextContent("−R$12.50");
    expect(log).toEqual([]);
    await userEvent.click(importButton());
    await waitFor(() => {
      expect(router.state.location.pathname).toBe(
        `/accounts/${checkingID}/imports/b9`,
      );
    });
    expect(log).toEqual(["PUT", "POST csv"]);
    expect(profiles).toEqual([saved]);
  });

  it("asks for the columns it cannot guess and sends nothing until then", async () => {
    const log: string[] = [];
    await renderApp(`/accounts/${checkingID}/import`, { fetch: api(log) });
    await choose(
      new File(["a,b,c\n1,2,3\n"], "export.csv", { type: "text/csv" }),
    );
    expect(
      await screen.findByRole("group", {
        name: catalogEn["importFile.profile"],
      }),
    ).toBeInTheDocument();
    expect(importButton()).toBeDisabled();
    expect(log).toEqual([]);
  });

  it("keeps a saved profile and sends only the file", async () => {
    const log: string[] = [];
    await renderApp(`/accounts/${checkingID}/import`, {
      fetch: api(log, {
        [`GET /api/v1/accounts/${checkingID}/csv-profile`]: () =>
          json(200, saved),
      }),
    });
    await choose(new File([csv], "extrato.csv", { type: "text/csv" }));
    await screen.findByRole("table", { name: catalogEn["importFile.preview"] });
    await userEvent.click(importButton());
    await waitFor(() => {
      expect(log).toEqual(["POST csv"]);
    });
  });

  it("sends an OFX file without a profile", async () => {
    const log: string[] = [];
    await renderApp(`/accounts/${checkingID}/import`, { fetch: api(log) });
    await choose(
      new File(["OFXHEADER:100"], "extrato.ofx", { type: "application/x-ofx" }),
    );
    await waitFor(() => {
      expect(importButton()).toBeEnabled();
    });
    expect(
      screen.queryByRole("group", { name: catalogEn["importFile.profile"] }),
    ).not.toBeInTheDocument();
    await userEvent.click(importButton());
    await waitFor(() => {
      expect(log).toEqual(["POST ofx"]);
    });
  });

  it("refuses a file over 10 MiB before sending it", async () => {
    const log: string[] = [];
    await renderApp(`/accounts/${checkingID}/import`, { fetch: api(log) });
    await choose(
      new File([new Uint8Array(10 * 1024 * 1024 + 1)], "big.ofx", {
        type: "application/x-ofx",
      }),
    );
    expect(
      await screen.findByText(catalogEn["importFile.tooLarge"]),
    ).toBeInTheDocument();
    expect(importButton()).toBeDisabled();
    expect(log).toEqual([]);
  });

  it("states the server's refusal under the file", async () => {
    await renderApp(`/accounts/${checkingID}/import`, {
      fetch: api([], {
        [`POST /api/v1/accounts/${checkingID}/imports`]: () =>
          problem(413, "request_too_large"),
      }),
    });
    await choose(
      new File(["OFXHEADER:100"], "extrato.ofx", { type: "application/x-ofx" }),
    );
    await waitFor(() => {
      expect(importButton()).toBeEnabled();
    });
    await userEvent.click(importButton());
    expect(
      await screen.findByText(catalogEn["problem.request_too_large"]),
    ).toBeInTheDocument();
  });
});
