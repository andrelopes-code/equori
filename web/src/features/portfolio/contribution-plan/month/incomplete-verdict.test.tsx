import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import type { components } from "@/api/schema.gen";
import { IncompleteVerdict } from "@/features/portfolio/contribution-plan/month/incomplete-verdict";
import { catalogEn } from "@/i18n/catalog.en";
import { json } from "@/testing/fake-api";
import { instrumentsApi } from "@/testing/instruments-api";
import { renderWithRouter } from "@/testing/render-app";

type Plan = components["schemas"]["ContributionPlan"];

describe("IncompleteVerdict", () => {
  it("records the missing price in place", async () => {
    const sent: unknown[] = [];
    const fetch = instrumentsApi({
      "POST /api/v1/prices": async (req) => {
        sent.push(await req.json());
        return json(201, {});
      },
    });
    const view = {
      missing: [{ instrument: "CDB1", kind: "price" }],
    } as unknown as Plan;
    renderWithRouter(<IncompleteVerdict view={view} />, {
      path: "/portfolio/contribution-plan",
      fetch,
    });
    const user = userEvent.setup();

    await user.click(
      await screen.findByRole("button", {
        name: catalogEn["contributionPlan.recordPrice"].replace(
          "{name}",
          "CDB1",
        ),
      }),
    );
    const dialog = await screen.findByRole("dialog");
    await user.type(
      within(dialog).getByRole("textbox", { name: /^Price/ }),
      "1012.5",
    );
    await user.click(
      within(dialog).getByRole("button", {
        name: catalogEn["instrument.price.save"],
      }),
    );

    await waitFor(() => {
      expect(sent).toHaveLength(1);
    });
    expect(sent[0]).toMatchObject({
      instrument: "CDB1",
      quote_instrument: "BRL",
    });
  });
});
