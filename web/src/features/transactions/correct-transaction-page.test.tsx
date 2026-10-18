import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { catalogPtBR } from "@/i18n/catalog.pt-BR";
import { writeLocale } from "@/i18n/locale";
import { fakeApi, json, problem } from "@/testing/fake-api";
import { renderApp } from "@/testing/render-app";
import {
  checkingID,
  foodID,
  payeeID,
  sharedRoutes,
  transactionFixture,
  txID,
} from "@/testing/transaction-api";

const label = catalogPtBR;

function newApi(putResponses: (() => Response)[]) {
  const puts: unknown[] = [];
  let version = 3;
  const fetch = fakeApi({
    ...sharedRoutes,
    [`GET /api/v1/transactions/${txID}`]: () =>
      json(200, transactionFixture({ version })),
    [`PUT /api/v1/transactions/${txID}`]: async (req) => {
      puts.push(await req.json());
      const respond = putResponses[puts.length - 1];
      // The conflicting write is the one that moved the stored version.
      if (puts.length === 1) version = 4;
      return respond?.() ?? json(200, transactionFixture({ version: 5 }));
    },
  });
  return { fetch, puts };
}

function postingAmount(n: number): string {
  return label["transactions.new.postingAmount"].replace("{n}", String(n));
}

async function setAmount(
  user: ReturnType<typeof userEvent.setup>,
  n: number,
  text: string,
) {
  const field = await screen.findByRole("spinbutton", {
    name: postingAmount(n),
  });
  await user.clear(field);
  await user.type(field, text);
}

const unchanged = {
  date: "2026-10-10",
  description: "Weekly shop",
  payee_id: payeeID,
  tags: ["food"],
};

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  writeLocale("pt-BR");
});

describe("correct transaction", () => {
  it("prefills the form from the transaction and requires a reason", async () => {
    const { fetch, puts } = newApi([]);
    const user = userEvent.setup();
    await renderApp(`/transactions/${txID}/correct`, { fetch });
    expect(
      (
        await screen.findByRole("textbox", {
          name: label["transactions.new.description"],
        })
      ).getAttribute("value"),
    ).toBe("Weekly shop");
    expect(
      (await screen.findByRole("spinbutton", { name: postingAmount(1) }))
        .getAttribute("value")
        ?.replace(/\s+/g, " "),
    ).toBe("-R$ 120,00");
    await user.click(
      screen.getByRole("button", { name: label["transaction.correct.save"] }),
    );
    expect(
      await screen.findByText(label["transaction.correct.reasonRequired"]),
    ).toBeTruthy();
    expect(puts).toEqual([]);
  });

  it("sends the loaded version and the reason, then opens the transaction", async () => {
    const { fetch, puts } = newApi([]);
    const user = userEvent.setup();
    const { router } = await renderApp(`/transactions/${txID}/correct`, {
      fetch,
    });
    await user.type(
      await screen.findByRole("textbox", {
        name: label["transaction.correct.reason"],
      }),
      "wrong value",
    );
    await user.click(
      screen.getByRole("button", { name: label["transaction.correct.save"] }),
    );
    await waitFor(() => {
      expect(puts).toEqual([
        {
          ...unchanged,
          postings: [
            {
              account_id: checkingID,
              amount: { amount: -12000, currency: "BRL" },
            },
            { account_id: foodID, amount: { amount: 12000, currency: "BRL" } },
          ],
          expected_version: 3,
          reason: "wrong value",
        },
      ]);
    });
    await waitFor(() => {
      expect(router.state.location.pathname).toBe(`/transactions/${txID}`);
    });
  });

  it("keeps the edits on a version conflict and reapplies them on the current version", async () => {
    const { fetch, puts } = newApi([() => problem(409, "version_conflict")]);
    const user = userEvent.setup();
    await renderApp(`/transactions/${txID}/correct`, { fetch });
    await setAmount(user, 1, "-150,00");
    await setAmount(user, 2, "150,00");
    await user.type(
      screen.getByRole("textbox", {
        name: label["transaction.correct.reason"],
      }),
      "wrong value",
    );
    await user.click(
      screen.getByRole("button", { name: label["transaction.correct.save"] }),
    );
    const message = await screen.findByText(
      label["transaction.correct.conflict"].replace("{version}", "4"),
    );
    expect(message.closest("p")).not.toBeNull();
    expect(
      screen
        .getByRole("spinbutton", { name: postingAmount(1) })
        .getAttribute("value")
        ?.replace(/\s+/g, " "),
    ).toBe("-R$ 150,00");
    await user.click(
      screen.getByRole("button", {
        name: label["transaction.correct.reapply"],
      }),
    );
    const postings = [
      { account_id: checkingID, amount: { amount: -15000, currency: "BRL" } },
      { account_id: foodID, amount: { amount: 15000, currency: "BRL" } },
    ];
    await waitFor(() => {
      expect(puts).toEqual([
        { ...unchanged, postings, expected_version: 3, reason: "wrong value" },
        { ...unchanged, postings, expected_version: 4, reason: "wrong value" },
      ]);
    });
  });
});
