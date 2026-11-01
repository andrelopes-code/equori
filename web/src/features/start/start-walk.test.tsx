import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { catalogEn } from "@/i18n/catalog.en";
import { chooseAccount } from "@/testing/account-choice";
import { accountRoutes } from "@/testing/account-api";
import { fakeApi, json } from "@/testing/fake-api";
import { optionalName } from "@/testing/optional-name";
import { renderApp } from "@/testing/render-app";

const checkingID = "e0000000-0000-4000-8000-000000000001";
const foodID = "e0000000-0000-4000-8000-000000000002";

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

describe("First-use walk", () => {
  // S251: A177.1, the unaided walk from /start to the first recorded transaction.
  it("reaches a saved transaction through visible names only", async () => {
    const accounts: unknown[] = [];
    const sent: unknown[] = [];
    await renderApp("/start", {
      fetch: fakeApi(
        accountRoutes({
          "GET /api/v1/accounts": () => json(200, { items: accounts }),
          "POST /api/v1/accounts": async (req) => {
            const body = (await req.json()) as { class?: string };
            const isCategory = body.class === "expense";
            const account = {
              ...body,
              id: isCategory ? foodID : checkingID,
              class: body.class ?? "asset",
              yield_mode: "none",
            };
            accounts.push(account);
            return json(201, account);
          },
          "POST /api/v1/transactions": async (req) => {
            sent.push(await req.json());
            return json(201, { id: "f0000000-0000-4000-8000-0000000000aa" });
          },
        }),
      ),
    });

    await userEvent.click(
      await screen.findByRole("combobox", {
        name: catalogEn["start.where.institution"],
      }),
    );
    await userEvent.click(
      await screen.findByRole("option", { name: /^Nubank/ }),
    );
    await userEvent.click(
      await screen.findByRole("checkbox", {
        name: catalogEn["kind.title.checking"],
      }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: catalogEn["start.continue"] }),
    );
    await userEvent.click(
      await screen.findByRole("button", {
        name: catalogEn["start.details.create"],
      }),
    );
    await userEvent.click(
      await screen.findByRole("button", { name: catalogEn["start.continue"] }),
    );
    await userEvent.click(
      await screen.findByRole("link", {
        name: catalogEn["start.arrive.record"],
      }),
    );
    await userEvent.type(
      await screen.findByRole("textbox", { name: catalogEn["entry.amount"] }),
      "1500",
    );
    await chooseAccount(catalogEn["entry.payWith"], "Nubank checking");
    await userEvent.type(
      screen.getByRole("combobox", {
        name: optionalName(catalogEn["category.label"]),
      }),
      "Food",
    );
    await userEvent.click(
      await screen.findByRole("option", {
        name: catalogEn["category.create"].replace("{query}", "Food"),
      }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: catalogEn["entry.save"] }),
    );

    await waitFor(() => {
      expect(sent).toHaveLength(1);
    });
    expect(sent[0]).toMatchObject({
      postings: [
        { account_id: checkingID, amount: { amount: -1500 } },
        { account_id: foodID, amount: { amount: 1500 } },
      ],
    });
  }, 30_000);
});
