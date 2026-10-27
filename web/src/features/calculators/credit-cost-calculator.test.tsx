import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { catalogEn } from "@/i18n/catalog.en";
import { calculatorApiRoutes } from "@/testing/calculator-api";
import { fakeApi, json } from "@/testing/fake-api";
import { renderApp } from "@/testing/render-app";

async function result(label: string): Promise<string> {
  const term = await screen.findByText(label, { selector: "dt" });
  return term.parentElement?.querySelector("dd")?.textContent ?? "";
}

const offer =
  "released=1000000&fees=20000&installment=88849&count=12&releaseDate=2026-01-10&firstDue=2026-02-10";

const open = (region?: string) =>
  renderApp(`/calculators/credit-cost?${offer}`, {
    fetch: fakeApi({
      ...calculatorApiRoutes(),
      ...(region === undefined
        ? {}
        : {
            "GET /api/v1/me": () =>
              json(200, {
                id: 1,
                email: "a@b.c",
                role: "admin",
                language: "en",
                region,
              }),
          }),
    }),
  });

describe("Cost of credit calculator", () => {
  it("computes the effective annual cost with 2 decimals", async () => {
    await open();
    expect(await result(catalogEn["calc.credit.annual"])).toBe("17.14%");
  });

  it("lists the 12 flows with their days from the release", async () => {
    await open();
    const table = await screen.findByRole("table", {
      name: catalogEn["calc.credit.flows"],
    });
    const rows = within(table).getAllByRole("row");
    expect(rows).toHaveLength(13);
    // 2026-02-10 is 31 days after 2026-01-10.
    expect(rows[1]?.textContent).toContain("31");
  });

  it("names the CET only for Brazil", async () => {
    const { unmount } = await open();
    await result(catalogEn["calc.credit.annual"]);
    expect(screen.queryByText(catalogEn["calc.credit.cet"])).toBeNull();
    unmount();
    await open("BR");
    expect(
      await screen.findByText(catalogEn["calc.credit.cet"]),
    ).toBeInTheDocument();
  });
});
