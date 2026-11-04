import { screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { catalogEn } from "@/i18n/catalog.en";
import { money } from "@/testing/account-api";
import { json } from "@/testing/fake-api";
import {
  planningApi as api,
  rentOctober,
  salary,
  streaming,
} from "@/testing/planning-api";
import { renderApp } from "@/testing/render-app";
import {
  sharedRoutes,
  transactionFixture,
  txID,
} from "@/testing/transaction-api";

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

function words(key: keyof typeof catalogEn, values: Record<string, string>) {
  return Object.entries(values).reduce<string>(
    (text, [k, v]) => text.replace(`{${k}}`, v),
    catalogEn[key],
  );
}

function agendaApi(items: object[]) {
  return api({ "GET /api/v1/occurrences": () => json(200, { items }) });
}

describe("Agenda received amounts", () => {
  it("shows what an expense paid and its percent against the expected amount", async () => {
    const paid = { ...streaming, actual_amount: money(4190) };
    await renderApp("/planning", { fetch: agendaApi([paid]) });

    const row = await screen.findByRole("row", { name: /^Streaming/ });

    expect(
      within(row).getByText(words("occurrence.paid", { amount: "R$41.90" })),
    ).toBeInTheDocument();
    expect(
      within(row).getByText(
        words("occurrence.variance", { percent: "+5.01%" }),
      ),
    ).toBeInTheDocument();
  });

  it("shows what an income received and its percent against the expected amount", async () => {
    const received = {
      ...salary,
      state: "realized",
      actual_amount: money(499900),
    };
    await renderApp("/planning", { fetch: agendaApi([received]) });

    const row = await screen.findByRole("row", { name: /^Salary/ });

    expect(
      within(row).getByText(
        words("occurrence.received", { amount: "R$4,999.00" }),
      ),
    ).toBeInTheDocument();
    expect(
      within(row).getByText(
        words("occurrence.variance", { percent: "\u22120.02%" }),
      ),
    ).toBeInTheDocument();
  });

  it("shows the received amount alone when it equals the expected one", async () => {
    const exact = {
      ...rentOctober,
      state: "realized",
      actual_amount: money(210000),
    };
    await renderApp("/planning", { fetch: agendaApi([exact]) });

    const row = await screen.findByRole("row", { name: /^Rent/ });

    expect(
      within(row).getByText(words("occurrence.paid", { amount: "R$2,100.00" })),
    ).toBeInTheDocument();
    expect(within(row).queryByText(/%/)).toBeNull();
  });

  it("shows no received amount for an occurrence that is not realized", async () => {
    await renderApp("/planning", { fetch: agendaApi([salary]) });

    await screen.findByRole("rowheader", { name: "Salary" });

    expect(screen.queryByText(/^Received /)).toBeNull();
  });
});

describe("Transaction detail received amounts", () => {
  it("shows what the transaction paid beside the expected amount", async () => {
    const paid = {
      ...rentOctober,
      state: "realized",
      transaction_id: txID,
      actual_amount: money(205000),
    };
    const fetch = api({
      ...sharedRoutes,
      [`GET /api/v1/transactions/${txID}`]: () =>
        json(200, transactionFixture()),
      "GET /api/v1/occurrences": () => json(200, { items: [paid] }),
    });
    await renderApp(`/transactions/${txID}`, { fetch });

    const section = await screen.findByRole("region", {
      name: catalogEn["detail.occurrences"],
    });

    expect(
      await within(section).findByText(
        words("occurrence.paid", { amount: "R$2,050.00" }),
      ),
    ).toBeInTheDocument();
    expect(
      within(section).getByText(
        words("occurrence.variance", { percent: "\u22122.38%" }),
      ),
    ).toBeInTheDocument();
  });
});
