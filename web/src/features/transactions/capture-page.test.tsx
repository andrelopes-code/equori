import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { catalogEn } from "@/i18n/catalog.en";
import { fakeApi, json, problem } from "@/testing/fake-api";
import { renderApp } from "@/testing/render-app";
import {
  accounts,
  checkingID,
  foodID,
  leisureID,
  payeeID,
  savingsID,
  sharedRoutes,
  transactionFixture,
} from "@/testing/transaction-api";

const money = (amount: number) => ({ amount, currency: "BRL" });
const uncategorizedID = "99999999-9999-4999-8999-999999999999";

const groceries = {
  line: 1,
  text: "mercado 230 itau",
  segments: [
    { text: "mercado ", role: "text" },
    { text: "230", role: "amount" },
    { text: " ", role: "text" },
    { text: "itau", role: "account" },
  ],
  kind: "expense",
  amount: money(23000),
  date: "2026-10-17",
  account_id: checkingID,
  account_source: "text",
  description: "Mercado",
  category_id: foodID,
  category_source: "rule",
  payee_id: payeeID,
  tags: [],
  issues: [],
};

const bakery = {
  line: 2,
  text: "padaria 2 irmaos 15",
  segments: [{ text: "padaria 2 irmaos 15", role: "text" }],
  kind: "expense",
  date: "2026-10-17",
  account_id: savingsID,
  account_source: "default",
  description: "Padaria irmaos",
  tags: [],
  issues: [
    {
      code: "ambiguous_amount",
      field: "amount",
      choices: [
        { amount: money(200), description: "Padaria irmaos 15" },
        { amount: money(1500), description: "Padaria 2 irmaos" },
      ],
    },
  ],
};

function api(
  previews: { text: string; default_account_id?: string }[],
  sent: unknown[],
  batch: () => Response = () =>
    json(201, { items: [transactionFixture(), transactionFixture()] }),
  extra: Record<string, (req: Request) => Promise<Response>> = {},
) {
  return fakeApi({
    ...extra,
    ...sharedRoutes,
    "GET /api/v1/accounts": () =>
      json(200, {
        items: [
          ...accounts,
          {
            id: uncategorizedID,
            name: "Uncategorized",
            class: "expense",
            currency: "BRL",
            system_role: "uncategorized_expense",
          },
        ],
      }),
    "POST /api/v1/capture/preview": async (req) => {
      const body = (await req.json()) as { text: string };
      previews.push(body);
      return json(200, {
        lines: [groceries, bakery].slice(0, body.text.split("\n").length),
      });
    },
    "POST /api/v1/transaction-batches": async (req) => {
      sent.push(await req.json());
      return batch();
    },
  });
}

async function write(text: string) {
  const area = await screen.findByRole("textbox", {
    name: catalogEn["capture.text"],
  });
  await userEvent.click(area);
  await userEvent.paste(text);
}

const recordButton = (count: number) =>
  screen.getByRole("button", {
    name: catalogEn["capture.record"].replace("{count}", String(count)),
  });

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

describe("CapturePage", () => {
  it("records every draft in one batch once each reading is settled", async () => {
    const previews: { text: string }[] = [];
    const sent: unknown[] = [];
    await renderApp("/transactions/capture", { fetch: api(previews, sent) });
    await write("mercado 230 itau\npadaria 2 irmaos 15");

    const drafts = await screen.findByRole("list", {
      name: catalogEn["capture.drafts"],
    });
    await waitFor(() => {
      expect(within(drafts).getByText("Mercado")).toBeVisible();
    });
    expect(previews.at(-1)).toEqual({
      text: "mercado 230 itau\npadaria 2 irmaos 15",
    });
    expect(
      within(drafts).getByText(catalogEn["capture.issue.ambiguous_amount"]),
    ).toBeVisible();

    await userEvent.click(recordButton(2));
    expect(await screen.findByText(catalogEn["capture.fix"])).toBeVisible();
    expect(sent).toEqual([]);

    await userEvent.click(
      within(drafts).getByRole("button", { name: "R$15.00" }),
    );
    expect(
      within(drafts).queryByText(catalogEn["capture.issue.ambiguous_amount"]),
    ).toBeNull();
    expect(within(drafts).getByText("Padaria 2 irmaos")).toBeVisible();

    await userEvent.click(recordButton(2));
    await waitFor(() => {
      expect(sent).toEqual([
        {
          entries: [
            {
              transaction: {
                date: "2026-10-17",
                description: "Mercado",
                payee_id: payeeID,
                postings: [
                  { account_id: checkingID, amount: money(-23000) },
                  { account_id: foodID, amount: money(23000) },
                ],
              },
            },
            {
              transaction: {
                date: "2026-10-17",
                description: "Padaria 2 irmaos",
                postings: [
                  { account_id: savingsID, amount: money(-1500) },
                  { account_id: uncategorizedID, amount: money(1500) },
                ],
              },
            },
          ],
        },
      ]);
    });
    // The toast's title, and its copy in the announcing region.
    expect(
      await screen.findAllByText(
        catalogEn["capture.recorded"].replace("{count}", "2"),
      ),
    ).toHaveLength(2);
    expect(
      screen.getByRole("textbox", { name: catalogEn["capture.text"] }),
    ).toHaveValue("");
  });

  it("records the category a language model suggests for an uncategorized draft", async () => {
    const sent: unknown[] = [];
    const asked: unknown[] = [];
    await renderApp("/transactions/capture", {
      fetch: api([], sent, undefined, {
        "POST /api/v1/capture/suggestions": async (req) => {
          asked.push(await req.json());
          return json(200, {
            available: true,
            items: [{ category_id: leisureID, source: "model" }],
          });
        },
      }),
    });
    await write("mercado 230 itau\npadaria 2 irmaos 15");
    await userEvent.click(
      await screen.findByRole("button", { name: "R$15.00" }),
    );
    expect(
      await screen.findByText(/Lazer \(suggested by AI\)/, undefined, {
        timeout: 4000,
      }),
    ).toBeVisible();
    expect(asked).toEqual([
      { items: [{ description: "Padaria 2 irmaos", kind: "expense" }] },
    ]);
    await userEvent.click(recordButton(2));
    await waitFor(() => {
      expect(sent).toHaveLength(1);
    });
    expect(sent[0]).toMatchObject({
      entries: [
        {},
        {
          transaction: {
            postings: [
              { account_id: savingsID, amount: money(-1500) },
              { account_id: leisureID, amount: money(1500) },
            ],
          },
        },
      ],
    });
  });

  it("names the line the server refused and records nothing", async () => {
    const sent: unknown[] = [];
    await renderApp("/transactions/capture", {
      fetch: api([], sent, () =>
        problem(422, "validation_failed", {
          errors: [
            {
              field: "entries[0].transaction.postings[0].account_id",
              message: "account is not open on the transaction date",
            },
          ],
        }),
      ),
    });
    await write("mercado 230 itau");
    await waitFor(() => {
      expect(recordButton(1)).toBeEnabled();
    });
    await userEvent.click(recordButton(1));
    const refused = catalogEn["capture.refused"]
      .replace("{line}", "1")
      .replace("{reason}", "account is not open on the transaction date");
    expect(await screen.findByText(refused)).toBeVisible();
    expect(
      screen.getByRole("textbox", { name: catalogEn["capture.text"] }),
    ).toHaveValue("mercado 230 itau");
  });

  it("keeps the text and the chosen readings after leaving the page", async () => {
    const { router } = await renderApp("/transactions/capture", {
      fetch: api([], []),
    });
    await write("mercado 230 itau\npadaria 2 irmaos 15");
    await userEvent.click(
      await screen.findByRole("button", { name: "R$15.00" }),
    );
    await router.navigate({ to: "/transactions" });
    await router.navigate({ to: "/transactions/capture" });
    expect(
      await screen.findByRole("textbox", { name: catalogEn["capture.text"] }),
    ).toHaveValue("mercado 230 itau\npadaria 2 irmaos 15");
    expect(await screen.findByText("Padaria 2 irmaos")).toBeVisible();
  });

  it("sends the default account and opens the text from N once used", async () => {
    const previews: { text: string; default_account_id?: string }[] = [];
    const { router } = await renderApp("/transactions/capture", {
      fetch: api(previews, []),
    });
    // The default account names an account before any amount: a sheet at every width.
    await userEvent.click(
      await screen.findByRole("button", {
        name: new RegExp(`^${catalogEn["capture.defaultAccount"]}`),
      }),
    );
    const sheet = await screen.findByRole("dialog", {
      name: catalogEn["capture.defaultAccount"],
    });
    expect(
      within(sheet).getByText(catalogEn["capture.defaultAccountHint"]),
    ).toBeVisible();
    await userEvent.click(
      within(sheet).getByRole("radio", { name: /^Reserva/ }),
    );
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
    await write("mercado 230 itau");
    await waitFor(() => {
      expect(previews.at(-1)).toEqual({
        text: "mercado 230 itau",
        default_account_id: savingsID,
      });
    });
    await router.navigate({ to: "/transactions" });
    await userEvent.keyboard("n");
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/transactions/capture");
    });
  });
});
