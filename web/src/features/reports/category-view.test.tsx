import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { catalogEn } from "@/i18n/catalog.en";
import { fakeApi, json } from "@/testing/fake-api";
import { renderApp } from "@/testing/render-app";
import { categoryReportRoutes, categoryTotalsAt } from "@/testing/report-api";

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
});
