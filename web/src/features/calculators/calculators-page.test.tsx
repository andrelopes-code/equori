import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { calculators } from "@/features/calculators/calculators";
import { catalogEn } from "@/i18n/catalog.en";
import { calculatorApiRoutes } from "@/testing/calculator-api";
import { fakeApi } from "@/testing/fake-api";
import { renderApp } from "@/testing/render-app";

describe("Calculators page", () => {
  it("lists the twelve calculators in three groups", async () => {
    await renderApp("/calculators", { fetch: fakeApi(calculatorApiRoutes()) });
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
    expect(calculators).toHaveLength(12);
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
