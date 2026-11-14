import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { catalogEn } from "@/i18n/catalog.en";
import { openOtherAccounts } from "@/testing/account-choice";
import { chooseEntryKind } from "@/testing/entry-kind";
import { problem } from "@/testing/fake-api";
import {
  investmentApi as api,
  clearBrokerage,
  clearID,
  securityID,
} from "@/testing/investment-api";
import { renderApp } from "@/testing/render-app";
import { txID } from "@/testing/transaction-api";

const path = `/transactions/new?kind=custody_transfer&account_id=${securityID}`;
const held = { quantity: 100, cost: 100000 };

async function openReceivers() {
  await userEvent.click(
    await screen.findByRole("button", {
      name: new RegExp(catalogEn["custody.to"]),
    }),
  );
  await openOtherAccounts();

  return await screen.findAllByRole("option", { name: /XP|Clear/ });
}

async function chooseReceiver() {
  await openReceivers();
  await userEvent.click(await screen.findByRole("option", { name: /Clear/ }));
}

async function typeQuantity(text: string) {
  await userEvent.type(
    await screen.findByRole("textbox", { name: catalogEn["custody.quantity"] }),
    text,
  );
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

describe("custody transfer entry", () => {
  it("opens from the new entry flow", async () => {
    await renderApp("/transactions/new", { fetch: api([]) });
    await chooseEntryKind(
      userEvent.setup(),
      catalogEn["entry.kind.custody_transfer"],
    );

    expect(
      await screen.findByRole("button", {
        name: new RegExp(catalogEn["custody.to"]),
      }),
    ).toBeInTheDocument();
  });

  it("shows the held quantity of the giving holding", async () => {
    await renderApp(path, {
      fetch: api([], { held, extraAccounts: clearBrokerage }),
    });

    expect(
      await screen.findByText("Held: 100 MXRF11", { exact: false }),
    ).toBeInTheDocument();
  });

  it("leaves the giving brokerage out of the receiving list", async () => {
    await renderApp(path, {
      fetch: api([], { held, extraAccounts: clearBrokerage }),
    });
    const options = await openReceivers();

    expect(options.map((o) => o.getAttribute("data-key"))).toEqual([clearID]);
  });

  // S436: 40 of 100 units go to Clear.
  it("sends the transfer of S436 and opens the created transaction", async () => {
    const sent: unknown[] = [];
    const { router } = await renderApp(path, {
      fetch: api(sent, { held, extraAccounts: clearBrokerage }),
    });
    await chooseReceiver();
    await typeQuantity("40");
    await save();

    await waitFor(() => {
      expect(sent).toEqual([
        {
          account_id: securityID,
          brokerage_id: clearID,
          date: "2026-10-17",
          quantity: { amount: 40, currency: "MXRF11" },
        },
      ]);
    });
    await waitFor(() => {
      expect(router.state.location.pathname).toBe(`/transactions/${txID}`);
    });
  });

  // S437: the server refuses a quantity above the holding.
  it("shows the refusal of a quantity above the holding", async () => {
    await renderApp(path, {
      fetch: api([], {
        held,
        extraAccounts: clearBrokerage,
        custodyAnswer: () =>
          problem(422, "validation_failed", {
            errors: [{ field: "quantity", message: "Above the holding." }],
          }),
      }),
    });
    await chooseReceiver();
    await typeQuantity("101");
    await save();

    expect(await screen.findByText("Above the holding.")).toBeInTheDocument();
  });

  it("keeps a request without receiver or quantity out of the API", async () => {
    const sent: unknown[] = [];
    await renderApp(path, {
      fetch: api(sent, { held, extraAccounts: clearBrokerage }),
    });
    await screen.findByRole("textbox", { name: catalogEn["custody.quantity"] });

    await save();

    expect(
      (await screen.findAllByText(catalogEn["custody.required.to"])).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText(catalogEn["custody.required.quantity"]).length,
    ).toBeGreaterThan(0);
    expect(sent).toHaveLength(0);
  });

  // ADR 027 S3: the form is a phone route.
  it("draws the receiver and the quantity on a phone", async () => {
    await renderApp(path, {
      width: 390,
      fetch: api([], { held, extraAccounts: clearBrokerage }),
    });

    expect(
      await screen.findByRole("textbox", {
        name: catalogEn["custody.quantity"],
      }),
    ).toBeInTheDocument();
  });

  it("announces the recorded entry in a toast that opens it", async () => {
    const { router } = await renderApp(path, {
      fetch: api([], { held, extraAccounts: clearBrokerage }),
    });
    await chooseReceiver();
    await typeQuantity("40");

    await userEvent.click(
      screen.getByRole("button", { name: catalogEn["entry.saveAnother"] }),
    );

    expect(
      await screen.findAllByText(catalogEn["custody.created"]),
    ).not.toHaveLength(0);

    await userEvent.click(
      screen.getByRole("button", { name: catalogEn["entry.view"] }),
    );
    await waitFor(() => {
      expect(router.state.location.pathname).toBe(`/transactions/${txID}`);
    });
  });
});
