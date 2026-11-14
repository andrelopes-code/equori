import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { catalogEn } from "@/i18n/catalog.en";
import { chooseEntryKind } from "@/testing/entry-kind";
import { problem } from "@/testing/fake-api";
import {
  investmentApi as api,
  brokerID,
  securityID,
} from "@/testing/investment-api";
import { optionalName } from "@/testing/optional-name";
import { renderApp } from "@/testing/render-app";
import { txID } from "@/testing/transaction-api";

const path = `/transactions/new?kind=corporate_action&account_id=${securityID}`;

async function proportion(from: string, to: string) {
  await userEvent.type(
    await screen.findByRole("spinbutton", {
      name: catalogEn["action.ratioFrom"],
    }),
    from,
  );
  await userEvent.type(
    screen.getByRole("spinbutton", { name: catalogEn["action.ratioTo"] }),
    to,
  );
}

async function chooseAction(name: string) {
  await userEvent.click(await screen.findByRole("radio", { name }));
}

async function save() {
  await userEvent.click(
    screen.getByRole("button", { name: catalogEn["entry.save"] }),
  );
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

describe("corporate action entry", () => {
  it("opens from the new entry flow", async () => {
    await renderApp("/transactions/new", { fetch: api([]) });
    await chooseEntryKind(
      userEvent.setup(),
      catalogEn["entry.kind.corporate_action"],
    );

    expect(
      await screen.findByRole("spinbutton", {
        name: catalogEn["action.ratioFrom"],
      }),
    ).toBeInTheDocument();
  });

  // S431: 100 units, a split of 1 for 10.
  it("records the split of S431 and previews the units after", async () => {
    const sent: unknown[] = [];
    const { router } = await renderApp(path, {
      fetch: api(sent, { held: { quantity: 100, cost: 100000 } }),
    });
    await proportion("1", "10");

    expect(await screen.findByText("100 become 1,000")).toBeInTheDocument();

    await save();

    await waitFor(() => {
      expect(sent).toEqual([
        {
          brokerage_id: brokerID,
          instrument: "MXRF11",
          kind: "split",
          date: "2026-10-17",
          ratio_from: 1,
          ratio_to: 10,
        },
      ]);
    });
    await waitFor(() => {
      expect(router.state.location.pathname).toBe(`/transactions/${txID}`);
    });
  });

  // S432: 15 units, a reverse split of 10 for 1 leaves a fraction of 0.5.
  it("shows the fraction left out by the reverse split of S432", async () => {
    await renderApp(path, {
      fetch: api([], { held: { quantity: 15, cost: 15000 } }),
    });
    await chooseAction(catalogEn["action.kind.reverse_split"]);
    await proportion("10", "1");

    expect(await screen.findByText("15 become 1")).toBeInTheDocument();
    expect(
      screen.getByText(
        catalogEn["action.fraction"].replace("{fraction}", "0.5"),
      ),
    ).toBeInTheDocument();
  });

  // S433: the bonus asks the cost per new unit and the income category.
  it("sends the cost and the category of a bonus and shows the refusal of its category", async () => {
    const sent: unknown[] = [];
    await renderApp(path, {
      fetch: api(sent, {
        held: { quantity: 100, cost: 100000 },
        actionAnswer: () =>
          problem(422, "validation_failed", {
            errors: [{ field: "category_id", message: "Category required." }],
          }),
      }),
    });
    await chooseAction(catalogEn["action.kind.bonus"]);
    await proportion("10", "11");
    await userEvent.type(
      await screen.findByRole("textbox", {
        name: optionalName(catalogEn["action.unitCost"]),
      }),
      "5",
    );
    await save();

    expect(await screen.findByText("Category required.")).toBeInTheDocument();
    expect(sent).toEqual([
      {
        brokerage_id: brokerID,
        instrument: "MXRF11",
        kind: "bonus",
        date: "2026-10-17",
        ratio_from: 10,
        ratio_to: 11,
        unit_cost: "5",
      },
    ]);
  });

  it("keeps a request without a proportion out of the API", async () => {
    const sent: unknown[] = [];
    await renderApp(path, { fetch: api(sent) });
    await screen.findByRole("spinbutton", {
      name: catalogEn["action.ratioFrom"],
    });

    await save();

    expect(
      (await screen.findAllByText(catalogEn["setup.required"])).length,
    ).toBeGreaterThan(0);
    expect(sent).toHaveLength(0);
  });

  // ADR 027 S3: the form is a phone route.
  it("draws the proportion and the preview on a phone", async () => {
    await renderApp(path, {
      width: 390,
      fetch: api([], { held: { quantity: 100, cost: 100000 } }),
    });
    await proportion("1", "10");

    expect(await screen.findByText("100 become 1,000")).toBeInTheDocument();
  });

  it("announces the recorded entry in a toast that opens it", async () => {
    const { router } = await renderApp(path, { fetch: api([]) });
    await proportion("1", "10");

    await userEvent.click(
      screen.getByRole("button", { name: catalogEn["entry.saveAnother"] }),
    );

    expect(
      await screen.findAllByText(catalogEn["action.created"]),
    ).not.toHaveLength(0);

    await userEvent.click(
      screen.getByRole("button", { name: catalogEn["entry.view"] }),
    );
    await waitFor(() => {
      expect(router.state.location.pathname).toBe(`/transactions/${txID}`);
    });
  });
});
