import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { catalogEn } from "@/i18n/catalog.en";
import { fakeApi, json } from "@/testing/fake-api";
import { hideAmounts } from "@/testing/privacy";
import { renderApp } from "@/testing/render-app";
import {
  checkingAccountID,
  flowReportRoutes,
  savingsAccountID,
  visaID,
} from "@/testing/report-api";

const rowTexts = (table: HTMLElement) =>
  within(table)
    .getAllByRole("row")
    .map((row) =>
      [...row.querySelectorAll("th, td")].map((c) => c.textContent).join("|"),
    );

const flowsTable = () =>
  screen.findByRole("table", { name: catalogEn["report.flows.title"] });

async function choosePreset(
  user: ReturnType<typeof userEvent.setup>,
  label: string,
) {
  const group = screen.getByRole("group", {
    name: catalogEn["transactions.filter.period"],
  });
  const [, trigger] = within(group).getAllByRole("button");
  if (trigger === undefined) throw new Error("period trigger not found");
  await user.click(trigger);
  await user.click(await screen.findByRole("button", { name: label }));
}

const none = catalogEn["report.none"];

function api(overrides: Record<string, (req: Request) => Response> = {}) {
  const queries: URLSearchParams[] = [];
  const routes = flowReportRoutes();
  const fetch = fakeApi({
    ...routes,
    "GET /api/v1/reports/flows": (req) => {
      queries.push(new URL(req.url).searchParams);
      return routes["GET /api/v1/reports/flows"](req);
    },
    ...overrides,
  });
  return { fetch, queries };
}

describe("Reports flows", () => {
  afterEach(() => {
    localStorage.removeItem("equori.privacy");
  });

  it("lists the inflow and outflow of the first account per day (S115)", async () => {
    const { fetch, queries } = api();
    await renderApp("/reports?tab=flows", { fetch });
    const table = await flowsTable();
    await within(table).findByText("10/05/2026");
    expect(rowTexts(table)).toEqual([
      "Date|Inflow|Outflow|Result",
      "10/05/2026|R$1,000.00|R$125.00|+R$875.00",
      "10/07/2026|R$0.00|R$8.00|−R$8.00",
      "Total|R$1,000.00|R$133.00|+R$867.00",
    ]);
    expect(Object.fromEntries(queries[0] ?? [])).toEqual({
      account_id: checkingAccountID,
      from: "2026-10-01",
      to: "2026-10-31",
    });
  });

  it("adds the days of each month when the granularity is month", async () => {
    const { fetch } = api();
    await renderApp(
      "/reports?tab=flows&by=month&from=2026-09-01&to=2026-10-31",
      { fetch },
    );
    const table = await flowsTable();
    await within(table).findByText("Oct 2026");
    expect(rowTexts(table)).toEqual([
      "Month|Inflow|Outflow|Result",
      "Sep 2026|R$50.00|R$0.00|+R$50.00",
      "Oct 2026|R$1,000.00|R$133.00|+R$867.00",
      "Total|R$1,050.00|R$133.00|+R$917.00",
    ]);
  });

  it("reads the account of the address and offers the open accounts by group", async () => {
    const { fetch, queries } = api();
    await renderApp(`/reports?tab=flows&account=${savingsAccountID}`, {
      fetch,
    });
    await flowsTable();
    await waitFor(() => {
      expect(queries[0]?.get("account_id")).toBe(savingsAccountID);
    });
    const user = userEvent.setup();
    await user.click(
      screen.getByRole("combobox", { name: catalogEn["report.flows.account"] }),
    );
    const listbox = await screen.findByRole("listbox");
    for (const group of ["accounts", "cards", "reserves"] as const)
      expect(
        within(listbox).getByRole("group", {
          name: catalogEn[`accountChoice.group.${group}`],
        }),
      ).toBeInTheDocument();
    expect(
      within(listbox)
        .getAllByRole("option")
        .map((o) => o.textContent),
    ).toEqual(["Itau", "Visa", "Reserva"]);
    expect(visaID).toBeTruthy();
  });

  it("blocks a period of more than 366 days before the request", async () => {
    const { fetch, queries } = api();
    await renderApp("/reports?tab=flows&from=2025-01-01&to=2026-10-31", {
      fetch,
    });
    expect(
      await screen.findByText(catalogEn["report.period.tooLong"]),
    ).toBeInTheDocument();
    expect(queries).toEqual([]);
  });

  it("sets inflow, outflow and result against the period before", async () => {
    const { fetch, queries } = api();
    await renderApp(
      "/reports?tab=flows&compare=true&from=2026-10-01&to=2026-10-31",
      { fetch },
    );
    const table = await screen.findByRole("table", {
      name: catalogEn["report.flows.comparison"],
    });
    await within(table).findByText(catalogEn["report.flows.inflow"]);
    await waitFor(() => {
      expect(rowTexts(table)[1]).toContain("R$50.00");
    });
    expect(rowTexts(table)).toEqual([
      "|Total|Before|Difference|Difference %",
      "Inflow|R$1,000.00|R$50.00|+R$950.00|+1,900.00%",
      `Outflow|R$133.00|R$0.00|+R$133.00|${none}`,
      "Result|+R$867.00|+R$50.00|+R$817.00|+1,634.00%",
    ]);
    expect(queries.map((q) => q.get("from")).sort()).toEqual([
      "2026-09-01",
      "2026-10-01",
    ]);
  });

  it("writes the granularity, the account and the period to the address", async () => {
    const { fetch } = api();
    const { router } = await renderApp("/reports?tab=flows", { fetch });
    const user = userEvent.setup();
    await flowsTable();
    await user.click(
      screen.getByRole("radio", { name: catalogEn["report.flows.byMonth"] }),
    );
    await waitFor(() => {
      expect(router.state.location.search).toMatchObject({ by: "month" });
    });
    await choosePreset(user, catalogEn["transactions.period.thisYear"]);
    await waitFor(() => {
      expect(router.state.location.search).toMatchObject({
        from: "2026-01-01",
        to: "2026-12-31",
      });
    });
    await user.click(
      screen.getByRole("combobox", { name: catalogEn["report.flows.account"] }),
    );
    await user.click(await screen.findByRole("option", { name: "Reserva" }));
    await waitFor(() => {
      expect(router.state.location.search).toMatchObject({
        account: savingsAccountID,
      });
    });
  });

  it("masks the amounts and keeps the percentages in privacy mode", async () => {
    hideAmounts();
    const { fetch } = api();
    await renderApp(
      "/reports?tab=flows&compare=true&from=2026-10-01&to=2026-10-31",
      { fetch },
    );
    const table = await screen.findByRole("table", {
      name: catalogEn["report.flows.comparison"],
    });
    await waitFor(() => {
      expect(rowTexts(table).join("\n")).toContain("1,900.00%");
    });
    const text = rowTexts(table).join("\n");
    expect(text).not.toContain("1,000.00");
    expect(text).not.toContain("950.00");
  });

  it("reads in English, region GB and base currency EUR, with nothing Brazilian", async () => {
    const { fetch } = api({
      "GET /api/v1/me": () =>
        json(200, {
          id: 1,
          email: "a@b.c",
          role: "admin",
          language: "en",
          region: "GB",
        }),
      "GET /api/v1/settings": () => json(200, { base_currency: "EUR" }),
      "GET /api/v1/instruments": () =>
        json(200, {
          items: [{ code: "EUR", type: "currency", scale: 2, name: "Euro" }],
        }),
      "GET /api/v1/accounts": () =>
        json(200, {
          items: [
            {
              id: checkingAccountID,
              name: "Main",
              class: "asset",
              kind: "checking",
              currency: "EUR",
            },
          ],
        }),
      "GET /api/v1/reports/flows": () =>
        json(200, {
          items: [
            {
              date: "2026-10-05",
              inflow: { amount: 250000, currency: "EUR" },
              outflow: { amount: 0, currency: "EUR" },
            },
          ],
        }),
    });
    await renderApp("/reports?tab=flows", { fetch });
    const table = await flowsTable();
    await within(table).findAllByText("€2,500.00");
    expect(within(table).getByText("05/10/2026")).toBeInTheDocument();
    const text = document.body.textContent;
    expect(text).not.toContain("R$");
    expect(text).not.toContain("BRL");
    expect(text).not.toMatch(/Fluxo|Entrada|Saída/);
  });
});
