import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { catalogEn } from "@/i18n/catalog.en";
import { json, problem } from "@/testing/fake-api";
import { cdbTerms, instrumentsApi as api } from "@/testing/instruments-api";
import { renderApp } from "@/testing/render-app";

const termsRow = (term: string) =>
  screen.getAllByRole("term").find((el) => el.textContent === term)
    ?.nextElementSibling?.textContent;

describe("Fixed income terms", () => {
  it("shows the terms of a fixed income instrument (S123)", async () => {
    await renderApp("/instruments/CDB1", { fetch: api() });
    await screen.findByText("110%");
    expect(termsRow(catalogEn["terms.issuedOn"])).toBe("01/02/2026");
    expect(termsRow(catalogEn["terms.maturesOn"])).toBe("01/02/2027");
    expect(termsRow(catalogEn["terms.index"])).toBe("cdi");
    expect(termsRow(catalogEn["terms.percentOfIndex"])).toBe("110%");
    expect(termsRow(catalogEn["terms.spread"])).toBe("0%");
    expect(termsRow(catalogEn["terms.dayCount"])).toBe(
      catalogEn["instruments.dayCount.bus252"],
    );
    expect(termsRow(catalogEn["terms.faceValue"])).toBe("R$1,000.00");
  });

  it("saves the terms of S123 and states that saving replaces the earlier ones and their accrued prices", async () => {
    const sent: unknown[] = [];
    const fetch = api({
      "PUT /api/v1/instruments/CDB1/terms": async (req) => {
        sent.push(await req.json());
        return json(200, cdbTerms);
      },
    });
    await renderApp("/instruments/CDB1", { fetch });
    const user = userEvent.setup();
    await user.click(
      await screen.findByRole("button", { name: catalogEn["terms.change"] }),
    );
    const dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).getByText(catalogEn["terms.replaceNote"]),
    ).toBeInTheDocument();
    await user.click(
      within(dialog).getByRole("button", { name: catalogEn["terms.save"] }),
    );
    await waitFor(() => {
      expect(sent).toEqual([cdbTerms]);
    });
  });

  it("saves terms over an index with a spread (S124)", async () => {
    const sent: unknown[] = [];
    const fetch = api({
      "GET /api/v1/instruments/CDB1/terms": () => problem(404, "not_found"),
      "PUT /api/v1/instruments/CDB1/terms": async (req) => {
        sent.push(await req.json());
        return json(200, cdbTerms);
      },
    });
    await renderApp("/instruments/CDB1", { fetch });
    const user = userEvent.setup();
    await user.click(
      await screen.findByRole("button", { name: catalogEn["terms.set"] }),
    );
    const dialog = await screen.findByRole("dialog");
    await user.type(
      within(dialog).getByRole("textbox", { name: /^Index/ }),
      "ipca",
    );
    const spread = within(dialog).getByRole("textbox", {
      name: /^Annual spread/,
    });
    await user.clear(spread);
    await user.type(spread, "6");
    await user.click(
      within(dialog).getByRole("combobox", { name: /^Day count/ }),
    );
    await user.click(
      await screen.findByRole("option", {
        name: catalogEn["instruments.dayCount.act365"],
      }),
    );
    await user.type(
      within(dialog).getByRole("textbox", { name: /^Face value/ }),
      "100000",
    );
    await user.click(
      within(dialog).getByRole("button", { name: catalogEn["terms.save"] }),
    );
    await waitFor(() => {
      expect(sent).toEqual([
        {
          issued_on: "2026-10-17",
          matures_on: "2027-10-17",
          index_id: "ipca",
          percent_of_index_bp: 10000,
          spread_bp: 600,
          day_count: "act365",
          face_value: 100000,
        },
      ]);
    });
  });

  it("shows the problem the server returns for terms it refuses (S125)", async () => {
    const fetch = api({
      "PUT /api/v1/instruments/CDB1/terms": () =>
        problem(422, "validation_failed", {
          errors: [
            { field: "index_id", message: "bus252 requires the cdi index." },
          ],
        }),
    });
    await renderApp("/instruments/CDB1", { fetch });
    const user = userEvent.setup();
    await user.click(
      await screen.findByRole("button", { name: catalogEn["terms.change"] }),
    );
    const dialog = await screen.findByRole("dialog");
    await user.click(
      within(dialog).getByRole("button", { name: catalogEn["terms.save"] }),
    );
    expect(
      await within(dialog).findByText("bus252 requires the cdi index."),
    ).toBeInTheDocument();
  });

  it("offers no terms for an instrument that is not fixed income", async () => {
    let asked = 0;
    const fetch = api({
      "GET /api/v1/instruments/PETR4/terms": () => {
        asked += 1;
        return json(200, cdbTerms);
      },
    });
    await renderApp("/instruments/PETR4", { fetch });
    await screen.findByRole("heading", { name: "Petrobras PN" });
    await screen.findByRole("table", {
      name: catalogEn["instrument.positions.caption"],
    });
    expect(screen.queryByText(catalogEn["terms.title"])).toBeNull();
    expect(asked).toBe(0);
  });
});
