import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { InstrumentField } from "@/features/transactions/brokerage-account/instrument-field";
import { investmentApi } from "@/testing/investment-api";
import { renderWithProviders } from "@/testing/render-app";

async function options(heldCodes: readonly string[] | null) {
  renderWithProviders(
    <InstrumentField
      value={null}
      heldCodes={heldCodes}
      invalid={false}
      onChange={() => undefined}
    />,
    { fetch: investmentApi([]) },
  );
  await userEvent.click(await screen.findByRole("combobox"));
  return (await screen.findAllByRole("option")).map((o) => o.textContent);
}

describe("InstrumentField", () => {
  it("offers every investment of the catalog and no currency", async () => {
    const shown = await options(null);

    expect(shown).toHaveLength(3);
    expect(shown.join()).not.toContain("Real");
  });

  it("offers only the held codes of a sale", async () => {
    const shown = await options(["PETR4"]);

    expect(shown).toHaveLength(1);
    expect(shown[0]).toContain("PETR4");
  });
});
