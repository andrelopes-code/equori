import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { calculators } from "@/features/calculators/model/calculators";
import { catalogEn } from "@/i18n/catalog.en";
import { calculatorApiRoutes, cdiFixture } from "@/testing/calculator-api";
import { fakeApi } from "@/testing/fake-api";
import { renderApp } from "@/testing/render-app";

const expectedCdi = {
  ...cdiFixture(),
  expectations: {
    survey_date: "2026-10-16",
    items: [{ date: "2026-11-18", rate: "0.1" }],
  },
};

describe("Calculators page", () => {
  it("lists the thirteen calculators in three groups", async () => {
    await renderApp("/calculators", {
      fetch: fakeApi(calculatorApiRoutes([expectedCdi])),
    });
    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: catalogEn["calc.title"],
      }),
    ).toBeInTheDocument();
    for (const group of ["invest", "credit", "plan"] as const) {
      const region = screen.getByRole("region", {
        name: catalogEn[`calc.group.${group}`],
      });
      const ids = calculators.filter((c) => c.group === group).map((c) => c.id);
      const links = within(region).getAllByRole("link");
      expect(links.map((l) => l.getAttribute("href"))).toEqual(
        ids.map((id) => `/calculators/${id}`),
      );
      expect(links.map((l) => l.textContent)).toEqual(
        ids.map(
          (id) =>
            `${catalogEn[`calc.${id}.title`]}${catalogEn[`calc.${id}.question`]}`,
        ),
      );
    }
    expect(calculators).toHaveLength(13);
  });

  it("lists the indexer comparison only when an index has an expected path", async () => {
    const title = catalogEn["calc.indexer-comparison.title"];
    await renderApp("/calculators", {
      fetch: fakeApi(calculatorApiRoutes([expectedCdi])),
    });
    expect(await screen.findByText(title)).toBeInTheDocument();
  });

  it("leaves the indexer comparison out when no index has an expected path", async () => {
    const title = catalogEn["calc.indexer-comparison.title"];
    await renderApp("/calculators", {
      fetch: fakeApi(calculatorApiRoutes([cdiFixture()])),
    });
    await screen.findByText(catalogEn["calc.fixed-income.title"]);
    expect(screen.queryByText(title)).not.toBeInTheDocument();
  });

  it("shows the not-found screen for an unknown calculator", async () => {
    await renderApp("/calculators/nope", {
      fetch: fakeApi(calculatorApiRoutes()),
    });
    expect(
      await screen.findByText(catalogEn["common.notFound.title"]),
    ).toBeInTheDocument();
  });

  it("is a destination of the navigation", async () => {
    await renderApp("/calculators", { fetch: fakeApi(calculatorApiRoutes()) });
    const nav = screen.getByRole("navigation", {
      name: catalogEn["nav.label"],
    });
    expect(
      within(nav).getByRole("link", { name: catalogEn["nav.calculators"] }),
    ).toHaveAttribute("aria-current", "page");
  });
});
