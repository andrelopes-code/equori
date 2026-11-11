import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { catalogEn } from "@/i18n/catalog.en";
import { chooseEntryKind } from "@/testing/entry-kind";
import { problem } from "@/testing/fake-api";
import {
  brl,
  cashID,
  dividendsID,
  investmentApi as api,
  securityID,
  taxID,
} from "@/testing/investment-api";
import { moneyValue } from "@/testing/money-value";
import { optionalName } from "@/testing/optional-name";
import { renderApp } from "@/testing/render-app";
import { txID } from "@/testing/transaction-api";

const path = `/transactions/new?kind=investment_income&account_id=${securityID}`;

async function type(label: string | RegExp, text: string) {
  await userEvent.type(
    await screen.findByRole("textbox", { name: label }),
    text,
  );
}

async function pick(label: string | RegExp, text: string) {
  const input = await screen.findByRole("combobox", { name: label });
  await userEvent.click(input);
  await userEvent.type(input, text);
  await waitFor(() => {
    expect(screen.getAllByRole("option").length).toBeGreaterThan(0);
  });
  await userEvent.keyboard("{ArrowDown}{Enter}");
}

async function chooseType(label: string) {
  await userEvent.click(
    await screen.findByRole("combobox", { name: catalogEn["income.type"] }),
  );
  await userEvent.click(await screen.findByRole("option", { name: label }));
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

describe("investment income entry", () => {
  it("lists the income types the API returns, with the code when no label exists", async () => {
    await renderApp(path, {
      fetch: api([], { incomeTypes: ["dividend", "rent_x"] }),
    });
    await userEvent.click(
      await screen.findByRole("combobox", { name: catalogEn["income.type"] }),
    );
    const options = await screen.findAllByRole("option");
    expect(options.map((o) => o.textContent)).toEqual([
      catalogEn["income.type.dividend"],
      "rent_x",
    ]);
  });

  it("opens from the new entry flow and from the security account", async () => {
    await renderApp("/transactions/new", { fetch: api([]) });
    await chooseEntryKind(
      userEvent.setup(),
      catalogEn["entry.kind.investment_income"],
    );
    expect(
      await screen.findByRole("combobox", { name: catalogEn["income.type"] }),
    ).toBeInTheDocument();
  });

  // S22: the MXRF11 dividend, 100 × 0.10, is 10.00 with nothing withheld.
  it("records the dividend of S22 with its net amount", async () => {
    const sent: unknown[] = [];
    const { router } = await renderApp(path, { fetch: api(sent) });
    await chooseType(catalogEn["income.type.dividend"]);
    await type(catalogEn["income.gross"], "1000");
    expect(await screen.findAllByText(moneyValue(/10\.00/))).not.toHaveLength(
      0,
    );
    await pick(catalogEn["income.category"], "Dividends");
    await userEvent.click(
      screen.getByRole("button", { name: catalogEn["entry.save"] }),
    );
    await waitFor(() => {
      expect(sent).toEqual([
        {
          account_id: securityID,
          cash_account_id: cashID,
          income_type: "dividend",
          date: "2026-10-17",
          gross: brl(1000),
          withheld: brl(0),
          category_id: dividendsID,
        },
      ]);
    });
    await waitFor(() => {
      expect(router.state.location.pathname).toBe(`/transactions/${txID}`);
    });
  });

  // S22: the PETR4 JCP of 45.00 with 6.75 withheld is 38.25 net.
  it("records the JCP of S22 with the withheld amount and its category", async () => {
    const sent: unknown[] = [];
    await renderApp(path, { fetch: api(sent) });
    await chooseType(catalogEn["income.type.jcp"]);
    await type(catalogEn["income.gross"], "4500");
    await type(optionalName(catalogEn["income.withheld"]), "675");
    expect(await screen.findByText(moneyValue(/38\.25/))).toBeInTheDocument();
    await pick(catalogEn["income.category"], "Dividends");
    await pick(
      optionalName(catalogEn["income.withheldCategory"]),
      "Income tax",
    );
    await userEvent.click(
      screen.getByRole("button", { name: catalogEn["entry.save"] }),
    );
    await waitFor(() => {
      expect(sent).toEqual([
        {
          account_id: securityID,
          cash_account_id: cashID,
          income_type: "jcp",
          date: "2026-10-17",
          gross: brl(4500),
          withheld: brl(675),
          category_id: dividendsID,
          withheld_category_id: taxID,
        },
      ]);
    });
  });

  it("refuses a withheld amount that is not below the gross", async () => {
    const sent: unknown[] = [];
    await renderApp(path, { fetch: api(sent) });
    await chooseType(catalogEn["income.type.dividend"]);
    await type(catalogEn["income.gross"], "1000");
    await type(optionalName(catalogEn["income.withheld"]), "1000");
    await pick(catalogEn["income.category"], "Dividends");
    await userEvent.click(
      screen.getByRole("button", { name: catalogEn["entry.save"] }),
    );
    expect(
      await screen.findByText(catalogEn["income.withheldTooHigh"]),
    ).toBeInTheDocument();
    expect(sent).toHaveLength(0);
  });

  it("shows the problem the server returns on its field", async () => {
    await renderApp(path, {
      fetch: api([], {
        incomeAnswer: () =>
          problem(422, "validation_failed", {
            errors: [{ field: "income_type", message: "Type not accepted." }],
          }),
      }),
    });
    await chooseType(catalogEn["income.type.dividend"]);
    await type(catalogEn["income.gross"], "1000");
    await pick(catalogEn["income.category"], "Dividends");
    await userEvent.click(
      screen.getByRole("button", { name: catalogEn["entry.save"] }),
    );
    expect(await screen.findByText("Type not accepted.")).toBeInTheDocument();
  });

  it("keeps an unaccepted request out of the API when the type is missing", async () => {
    const sent: unknown[] = [];
    await renderApp(path, { fetch: api(sent) });
    await type(catalogEn["income.gross"], "1000");
    await userEvent.click(
      screen.getByRole("button", { name: catalogEn["entry.save"] }),
    );
    expect(
      await screen.findByText(catalogEn["income.required.type"]),
    ).toBeInTheDocument();
    expect(sent).toHaveLength(0);
  });
});
