import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { catalogEn } from "@/i18n/catalog.en";
import { fakeApi, json } from "@/testing/fake-api";
import { renderApp } from "@/testing/render-app";
import {
  categoryReportRoutes,
  categoryTotalsAt,
  marketID,
} from "@/testing/report-api";

beforeEach(() => {
  localStorage.clear();
});

// A region other than BR and a base currency other than BRL; every totals request is kept.
function api() {
  const views: (string | null)[] = [];
  const fetch = fakeApi({
    ...categoryReportRoutes(),
    "GET /api/v1/me": () =>
      json(200, {
        id: 1,
        email: "a@b.c",
        role: "admin",
        language: "en",
        region: "DE",
      }),
    "GET /api/v1/settings": () => json(200, { base_currency: "EUR" }),
    "GET /api/v1/instruments": () =>
      json(200, {
        items: [{ code: "EUR", type: "currency", scale: 2, name: "Euro" }],
      }),
    [`GET /api/v1/reports/categories/${marketID}/cash-payments`]: () =>
      json(200, {
        items: [
          {
            date: "2026-10-10",
            amount: { amount: 3000, currency: "EUR" },
            card_account_id: "cc000000-0000-4000-8000-000000000001",
            statement_id: "5e000000-0000-4000-8000-000000000001",
            statement_reference: "2026-10",
            payment_transaction_id: "7a000000-0000-4000-8000-000000000001",
          },
          {
            date: "2026-10-20",
            amount: { amount: 2000, currency: "EUR" },
            card_account_id: "cc000000-0000-4000-8000-000000000001",
            statement_id: "5e000000-0000-4000-8000-000000000002",
            statement_reference: "2026-11",
            payment_transaction_id: "7a000000-0000-4000-8000-000000000002",
          },
        ],
      }),
    "GET /api/v1/reports/categories": (req: Request) => {
      const q = new URL(req.url).searchParams;
      views.push(q.get("view"));
      return json(
        200,
        categoryTotalsAt(q.get("from") ?? "", q.get("class") ?? ""),
      );
    },
  });
  return { fetch, views };
}

describe("accrual and cash views", () => {
  it("switches the categories tab of the reports to the cash view in the address", async () => {
    const { fetch, views } = api();
    const { router } = await renderApp("/reports?tab=categories", { fetch });
    expect(
      await screen.findByText(catalogEn["view.accrual.rule"]),
    ).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("radio", { name: catalogEn["view.cash"] }),
    );
    await waitFor(() => {
      expect(router.state.location.search).toMatchObject({ view: "cash" });
    });
    expect(
      await screen.findByText(catalogEn["view.cash.rule"]),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(views).toContain("cash");
    });
    expect(views[0]).toBeNull();
  });

  it("reads the categories page in the view of the address and back to accrual", async () => {
    const { fetch, views } = api();
    const { router } = await renderApp("/categories?view=cash", { fetch });
    expect(
      await screen.findByText(catalogEn["view.cash.rule"]),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(views.length).toBeGreaterThan(0);
    });
    expect(new Set(views)).toEqual(new Set(["cash"]));
    await userEvent.click(
      screen.getByRole("radio", { name: catalogEn["view.accrual"] }),
    );
    await waitFor(() => {
      expect(router.state.location.search).not.toHaveProperty("view");
    });
    await waitFor(() => {
      expect(views).toContain(null);
    });
  });

  it("lists the card payments of a category in the cash view, each opening its statement and payment", async () => {
    const { fetch } = api();
    await renderApp(
      `/reports?tab=categories&view=cash&from=2026-10-01&to=2026-10-31&payments=${marketID}`,
      { fetch },
    );
    const table = await screen.findByRole("table", {
      name: "Card payments of Market",
    });
    await waitFor(() => {
      expect(within(table).getAllByRole("row")).toHaveLength(4);
    });
    const rows = within(table).getAllByRole("row");
    expect(rows.map((r) => r.textContent)).toEqual([
      "PaymentStatementAmount",
      "10/10/2026Oct 2026€30.00",
      "20/10/2026Nov 2026€20.00",
      "Total€50.00",
    ]);
    expect(
      within(table).getByRole("link", { name: "Oct 2026" }),
    ).toHaveAttribute(
      "href",
      "/cards/cc000000-0000-4000-8000-000000000001/statements/5e000000-0000-4000-8000-000000000001",
    );
    expect(
      within(table).getByRole("link", { name: "20/10/2026" }),
    ).toHaveAttribute(
      "href",
      "/transactions/7a000000-0000-4000-8000-000000000002",
    );
  });
});
