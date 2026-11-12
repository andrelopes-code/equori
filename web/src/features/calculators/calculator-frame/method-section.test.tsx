import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { MethodSection } from "@/features/calculators/calculator-frame/method-section";
import { catalogEn } from "@/i18n/catalog.en";
import { fakeApi } from "@/testing/fake-api";
import { renderWithProviders } from "@/testing/render-app";

function renderMethod() {
  return renderWithProviders(
    <MethodSection
      steps={["a", "b"]}
      formula={["F"]}
      assumptions={["x"]}
      limits={["y"]}
      sources={[{ title: "S", url: "https://example.org" }]}
    />,
    { fetch: fakeApi({}) },
  );
}

describe("MethodSection", () => {
  it("L4: holds the body absent until the layer is opened", () => {
    renderMethod();

    expect(
      screen.getByText(catalogEn["calc.method.description"]),
    ).toBeVisible();
    expect(screen.queryByText("a")).toBeNull();
  });

  it("L4: writes the steps, the formula and the aside parts in the layer", async () => {
    renderMethod();

    await userEvent
      .setup()
      .click(
        screen.getByRole("button", { name: catalogEn["calc.method.open"] }),
      );

    const steps = screen
      .getAllByRole("listitem")
      .filter((item) => item.parentElement?.tagName === "OL");
    expect(steps).toHaveLength(2);
    expect(screen.getByText("F")).toBeVisible();
    for (const key of [
      "calc.method.steps",
      "calc.method.formula",
      "calc.method.assumptions",
      "calc.method.limits",
      "calc.method.sources",
    ] as const) {
      expect(
        screen.getByRole("heading", { name: catalogEn[key] }),
      ).toBeVisible();
    }
    // The name of an external link ends with a note that it opens in a new tab.
    expect(screen.getByRole("link", { name: /^S\b/u })).toHaveAttribute(
      "href",
      "https://example.org",
    );
  });
});
