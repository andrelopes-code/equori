import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { calculators, written } from "@/features/calculators/model/calculators";
import { catalogEn } from "@/i18n/catalog.en";
import { calculatorApiRoutes, cdiFixture } from "@/testing/calculator-api";
import { fakeApi, problem } from "@/testing/fake-api";
import { renderApp } from "@/testing/render-app";

const expectedCdi = {
  ...cdiFixture(),
  expectations: {
    survey_date: "2026-10-16",
    items: [{ date: "2026-11-18", rate: "0.1" }],
  },
};

describe("Calculators page", () => {
  it("lists the eleven written calculators in three groups, each by its question", async () => {
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
      const ids = calculators
        .filter((c) => c.group === group && written.has(c.id))
        .map((c) => c.id);
      const links = within(region).getAllByRole("link");
      expect(links.map((l) => l.getAttribute("href"))).toEqual(
        ids.map((id) => `/calculators/${id}`),
      );
      expect(links.map((l) => l.textContent)).toEqual(
        ids.map(
          (id) =>
            `${catalogEn[`calc.${id}.question`]}${catalogEn[`calc.${id}.title`]}`,
        ),
      );
    }
    expect(screen.queryByText(catalogEn["calc.reserve.title"])).toBeNull();
    expect(screen.queryByText(catalogEn["calc.independence.title"])).toBeNull();
  });

  it("reads the subheading from the subtitle and gives the groups no description", async () => {
    await renderApp("/calculators", {
      fetch: fakeApi(calculatorApiRoutes([expectedCdi])),
    });
    expect(
      await screen.findByText(catalogEn["calc.subtitle"]),
    ).toBeInTheDocument();
    expect(catalogEn["calc.subtitle"]).toBe(
      "Published methods, each with its formula, assumptions and sources.",
    );
    const region = screen.getByRole("region", {
      name: catalogEn["calc.group.invest"],
    });
    expect(region).not.toHaveAccessibleDescription();
    expect(within(region).queryByText(/./, { selector: "p" })).toBeNull();
  });

  it("lists the indexer comparison only when an index has an expected path", async () => {
    const title = catalogEn["calc.indexer-comparison.title"];
    await renderApp("/calculators", {
      fetch: fakeApi(calculatorApiRoutes([expectedCdi])),
    });
    expect(await screen.findByText(title)).toBeInTheDocument();
    expect(screen.queryByText(catalogEn["calc.list.indexesAbsent"])).toBeNull();
  });

  it("leaves the indexer comparison out when no index has an expected path", async () => {
    const title = catalogEn["calc.indexer-comparison.title"];
    await renderApp("/calculators", {
      fetch: fakeApi(calculatorApiRoutes([cdiFixture()])),
    });
    const invest = await screen.findByRole("region", {
      name: catalogEn["calc.group.invest"],
    });
    expect(
      await within(invest).findByText(catalogEn["calc.list.indexesAbsent"]),
    ).toBeInTheDocument();
    expect(screen.queryByText(title)).not.toBeInTheDocument();
    expect(
      screen.getAllByText(catalogEn["calc.list.indexesAbsent"]),
    ).toHaveLength(1);
    expect(invest.parentElement).not.toHaveAttribute("aria-busy");
  });

  it("holds the comparison row and no note while the indexes load", async () => {
    await renderApp("/calculators", {
      fetch: fakeApi({
        ...calculatorApiRoutes(),
        "GET /api/v1/indexes": () => new Promise<Response>(() => undefined),
      }),
    });
    const invest = await screen.findByRole("region", {
      name: catalogEn["calc.group.invest"],
    });
    expect(
      within(invest).getByText(catalogEn["calc.indexer-comparison.title"]),
    ).toBeInTheDocument();
    expect(invest.parentElement).toHaveAttribute("aria-busy", "true");
    expect(screen.queryByText(catalogEn["calc.list.indexesAbsent"])).toBeNull();
    expect(screen.queryByText(catalogEn["calc.list.indexesFailed"])).toBeNull();
  });

  it("names the hidden comparison when the indexes fail to load", async () => {
    await renderApp("/calculators", {
      fetch: fakeApi({
        ...calculatorApiRoutes(),
        "GET /api/v1/indexes": () => problem(500, "internal"),
      }),
    });
    const invest = await screen.findByRole("region", {
      name: catalogEn["calc.group.invest"],
    });
    expect(
      await within(invest).findByText(catalogEn["calc.list.indexesFailed"]),
    ).toBeInTheDocument();
    expect(screen.queryByText(catalogEn["calc.list.indexesAbsent"])).toBeNull();
  });

  it("shows the not-found screen for an unknown calculator", async () => {
    await renderApp("/calculators/nope", {
      fetch: fakeApi(calculatorApiRoutes()),
    });
    expect(
      await screen.findByText(catalogEn["common.notFound.title"]),
    ).toBeInTheDocument();
  });

  it("shows the frame alone for a calculator not yet written", async () => {
    await renderApp("/calculators/reserve", {
      fetch: fakeApi(calculatorApiRoutes()),
    });
    expect(
      await screen.findByText(catalogEn["calc.unavailable"]),
    ).toBeInTheDocument();
  });

  it("draws the screen of a written calculator", async () => {
    await renderApp("/calculators/rates", {
      fetch: fakeApi(calculatorApiRoutes()),
    });
    await screen.findByRole("heading", {
      level: 1,
      name: catalogEn["calc.rates.title"],
    });
    expect(screen.queryByText(catalogEn["calc.unavailable"])).toBeNull();
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
