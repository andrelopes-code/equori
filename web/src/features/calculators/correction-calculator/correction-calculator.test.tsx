import { screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { catalogEn } from "@/i18n/catalog.en";
import { calculatorApiRoutes, ipcaFixture } from "@/testing/calculator-api";
import { fakeApi } from "@/testing/fake-api";
import { expectNoAmounts, hideAmounts } from "@/testing/privacy";
import { renderApp } from "@/testing/render-app";

async function result(label: string): Promise<string> {
  const term = await screen.findByText(label, { selector: "dt" });
  return term.parentElement?.querySelector("dd")?.textContent ?? "";
}

const open = (search: string) =>
  renderApp(`/calculators/correction?${search}`, {
    fetch: fakeApi(calculatorApiRoutes([ipcaFixture()])),
  });

describe("Correction by an index", () => {
  afterEach(() => {
    localStorage.removeItem("equori.privacy");
  });

  it("corrects an amount by the IPCA of 2020 (M7)", async () => {
    await open("index=ipca&amount=100000&from=2020-01&to=2020-12");
    expect(
      await screen.findByText(/1,045\.17/, { selector: "p" }),
    ).toBeVisible();
    expect(
      screen.getByText(catalogEn["calc.correction.answer.lead"]),
    ).toBeVisible();
    expect(
      screen.getByText("from Jan 2020 to Dec 2020 by IPCA."),
    ).toBeVisible();
    expect(await result(catalogEn["calc.correction.factor"])).toMatch(
      /^1\.0451\d{4}$/,
    );
    expect(await result(catalogEn["calc.correction.percent"])).toBe("4.5173%");
    expect(await result(catalogEn["calc.correction.months"])).toBe("12");
  });

  it("opens filled from the address, without the options section", async () => {
    await open("index=ipca&amount=100000&from=2020-01&to=2020-12");
    expect(
      await screen.findByText(/1,045\.17/, { selector: "p" }),
    ).toBeVisible();
    expect(screen.queryByText(catalogEn["calc.options"])).toBeNull();
  });

  // CR4: a start after the end is the sentence of the answer and the figure is a dash.
  it("refuses a start after the end in the sentence (CR4)", async () => {
    await open("index=ipca&amount=100000&from=2020-12&to=2020-01");
    expect(
      await screen.findByText(catalogEn["calc.correction.order"]),
    ).toBeVisible();
    expect(screen.getByText("—", { selector: "p" })).toBeVisible();
    expect(screen.queryByText(catalogEn["calc.correction.percent"])).toBeNull();
  });

  it("names the missing amount in the sentence", async () => {
    await open("index=ipca&from=2020-01&to=2020-12");
    expect(
      await screen.findByText("Fill in amount to see the corrected amount."),
    ).toBeVisible();
    expect(screen.getByText("—", { selector: "p" })).toBeVisible();
  });

  it("names the stored months under the answer when a month lies outside them", async () => {
    await open("index=ipca&amount=100000&from=2019-06&to=2020-12");
    expect(
      await screen.findByText(
        catalogEn["calc.correction.range"]
          .replace("{first}", "Jan 2020")
          .replace("{last}", "Dec 2020"),
      ),
    ).toBeVisible();
    expect(screen.getByText("—", { selector: "p" })).toBeVisible();
    expect(screen.queryByText(catalogEn["calc.correction.percent"])).toBeNull();
  });

  it("masks the amounts in privacy mode", async () => {
    hideAmounts();
    await open("index=ipca&amount=100000&from=2020-01&to=2020-12");
    await result(catalogEn["calc.correction.months"]);
    expectNoAmounts(
      screen.getByRole("region", { name: catalogEn["calc.results"] }),
      ["1,045.17"],
    );
  });
});
