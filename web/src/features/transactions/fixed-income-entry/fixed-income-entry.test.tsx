import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { catalogEn } from "@/i18n/catalog.en";
import { fakeApi, json, problem } from "@/testing/fake-api";
import { brokerID, cashID, investmentRoutes } from "@/testing/investment-api";
import { renderApp } from "@/testing/render-app";

const path = `/transactions/new?kind=fixed_income&brokerage_id=${brokerID}`;
const anyUuid = expect.stringMatching(/^[0-9a-f-]{36}$/) as unknown;
const anyDate = expect.stringMatching(/^\d{4}-\d\d-\d\d$/) as unknown;
const applicationID = "d0000000-0000-4000-8000-000000000001";

const owned = {
  code: "RF.280302.CS3YS",
  type: "fixed_income",
  scale: 2,
  name: "CDB Banco Inter",
  owned: true,
  issuer: { name: "Banco Inter" },
  quote_currency: "BRL",
  subtype: "cdb",
};

function api(
  sent: unknown[],
  answer: () => Response = () =>
    json(201, {
      instrument: owned.code,
      transaction_id: applicationID,
      quantity: { amount: 100000, currency: owned.code },
      unit_price: "1.00",
    }),
) {
  return fakeApi({
    ...investmentRoutes([]),
    "GET /api/v1/instruments": () => json(200, { items: [owned] }),
    "GET /api/v1/instrument-subtypes": () =>
      json(200, { items: ["cdb", "lci"] }),
    "GET /api/v1/indexes": () =>
      json(200, {
        items: [
          { id: "cdi", expected: false, period: "day", first: "2020-01-01" },
          { id: "ipca", expected: true, period: "month", first: "2020-01-01" },
        ],
      }),
    "POST /api/v1/fixed-income-applications": async (req: Request) => {
      sent.push(await req.json());
      return answer();
    },
  });
}

async function type(label: string | RegExp, text: string) {
  await userEvent.type(
    await screen.findByRole("textbox", { name: label }),
    text,
  );
}

async function typeMaturity(digits: string) {
  const field = await screen.findByRole("group", {
    name: new RegExp(catalogEn["fixedIncome.maturesOn"]),
  });
  await userEvent.click(
    within(field).getByRole("spinbutton", { name: "month" }),
  );
  await userEvent.keyboard(digits);
}

async function chooseSubtype(name: string) {
  await userEvent.click(
    await screen.findByRole("combobox", {
      name: catalogEn["fixedIncome.subtype"],
    }),
  );
  await userEvent.click(
    await screen.findByRole("option", { name: new RegExp(`^${name}$`, "i") }),
  );
}

async function save() {
  await userEvent.click(
    await screen.findByRole("button", { name: catalogEn["entry.save"] }),
  );
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fixed income entry", () => {
  it("opens in a page without randomUUID, as over plain http", async () => {
    vi.stubGlobal("crypto", {
      getRandomValues: crypto.getRandomValues.bind(crypto),
    });

    await renderApp(path, { fetch: api([]) });

    expect(
      await screen.findByRole("button", { name: catalogEn["entry.save"] }),
    ).toBeInTheDocument();
  });

  it("hides the cash account and shows the note when the application predates the book", async () => {
    await renderApp(path, { fetch: api([]) });
    expect(await screen.findByText(/^Paid from/)).toBeInTheDocument();

    await userEvent.click(
      await screen.findByRole("switch", {
        name: catalogEn["fixedIncome.opening"],
      }),
    );

    expect(
      await screen.findByText(catalogEn["fixedIncome.opening.note"]),
    ).toBeInTheDocument();
    expect(screen.queryByText(/^Paid from/)).not.toBeInTheDocument();
  });

  // S479
  it("sends the contract and the amount of the form and opens the transaction", async () => {
    const sent: unknown[] = [];
    const { router } = await renderApp(path, { fetch: api(sent) });
    await chooseSubtype("CDB");
    await userEvent.type(
      await screen.findByRole("combobox", {
        name: catalogEn["fixedIncome.issuer"],
      }),
      "Banco Inter",
    );
    await type(catalogEn["fixedIncome.amount"], "100000");
    await type(catalogEn["fixedIncome.percentOfIndex"], "110");
    await typeMaturity("01152028");
    await save();

    await waitFor(() => {
      expect(sent).toHaveLength(1);
    });
    expect(sent[0]).toEqual({
      application_id: anyUuid,
      brokerage_id: brokerID,
      cash_account_id: cashID,
      applied_on: anyDate,
      amount: { amount: 100000, currency: "BRL" },
      contract: {
        subtype: "cdb",
        issuer: "Banco Inter",
        matures_on: "2028-01-15",
        daily_liquidity: false,
        index_id: "cdi",
        percent_of_index_bp: 11000,
      },
    });
    await waitFor(() => {
      expect(router.state.location.pathname).toBe(
        `/transactions/${applicationID}`,
      );
    });
  });

  // A236 FC33
  it("sends the interest period chosen in the payments section", async () => {
    const sent: unknown[] = [];
    await renderApp(path, { fetch: api(sent) });
    await chooseSubtype("CDB");
    await userEvent.type(
      await screen.findByRole("combobox", {
        name: catalogEn["fixedIncome.issuer"],
      }),
      "Banco Inter",
    );
    await type(catalogEn["fixedIncome.amount"], "100000");
    await type(catalogEn["fixedIncome.percentOfIndex"], "110");
    await typeMaturity("01152028");
    await userEvent.click(
      await screen.findByRole("button", { name: catalogEn["terms.payments"] }),
    );
    await userEvent.click(
      await screen.findByRole("combobox", {
        name: catalogEn["terms.interestEvery"],
      }),
    );
    await userEvent.click(
      await screen.findByRole("option", {
        name: catalogEn["terms.interestEvery.6"],
      }),
    );
    const first = await screen.findByRole("group", {
      name: new RegExp(catalogEn["terms.firstPaymentOn"]),
    });
    await userEvent.click(
      within(first).getByRole("spinbutton", { name: "month" }),
    );
    await userEvent.keyboard("09022028");
    await save();

    await waitFor(() => {
      expect(sent).toHaveLength(1);
    });
    expect(sent[0]).toMatchObject({
      contract: { interest_every_months: 6, first_payment_on: "2028-09-02" },
    });
  });

  it("sends the instrument and no contract for an existing contract", async () => {
    const sent: unknown[] = [];
    await renderApp(`${path}&instrument=${owned.code}`, { fetch: api(sent) });
    await type(catalogEn["fixedIncome.amount"], "50000");
    await save();

    await waitFor(() => {
      expect(sent).toHaveLength(1);
    });
    expect(sent[0]).toEqual({
      application_id: anyUuid,
      brokerage_id: brokerID,
      cash_account_id: cashID,
      applied_on: anyDate,
      amount: { amount: 50000, currency: "BRL" },
      instrument: owned.code,
    });
  });

  it("shows the message of a contract field under its input", async () => {
    const sent: unknown[] = [];
    const fetch = api(sent, () =>
      problem(422, "contract_invalid", {
        errors: [
          { field: "contract.matures_on", message: "Maturity is in the past." },
        ],
      }),
    );
    await renderApp(path, { fetch });
    await chooseSubtype("CDB");
    await userEvent.type(
      await screen.findByRole("combobox", {
        name: catalogEn["fixedIncome.issuer"],
      }),
      "Banco Inter",
    );
    await type(catalogEn["fixedIncome.amount"], "100000");
    await type(catalogEn["fixedIncome.percentOfIndex"], "110");
    await typeMaturity("01152028");
    await save();

    const message = await screen.findByText("Maturity is in the past.");

    const field = message.closest<HTMLElement>("[data-ui=field]");

    expect(field).not.toBeNull();
    expect(
      within(field ?? message).getByRole("group", {
        name: new RegExp(catalogEn["fixedIncome.maturesOn"]),
      }),
    ).toBeInTheDocument();
  });

  it("names the missing issuer and rate without sending", async () => {
    const sent: unknown[] = [];
    await renderApp(path, { fetch: api(sent) });
    await type(catalogEn["fixedIncome.amount"], "100000");
    await save();

    expect(
      await screen.findByText(catalogEn["fixedIncome.required.issuer"]),
    ).toBeInTheDocument();
    expect(
      screen.getByText(catalogEn["fixedIncome.required.rate"]),
    ).toBeInTheDocument();
    expect(sent).toHaveLength(0);
  });
});
