// @vitest-environment node
import { describe, expect, it } from "vitest";

import { emptyAccountDraft } from "@/features/accounts/model/account-draft";
import type { AccountDraft } from "@/features/accounts/model/account-draft";
import {
  accountInput,
  createAccountSteps,
} from "@/features/accounts/model/create-account-steps";
import { fakeApi, json } from "@/testing/fake-api";
import { testClient } from "@/testing/test-client";
import { emptyFace } from "@/ui/card-face/studio/face-draft";

const opening = "e0000000-0000-4000-8000-000000000001";
const created = "e0000000-0000-4000-8000-000000000002";
const cash = "e0000000-0000-4000-8000-000000000003";
const institution = "e0000000-0000-4000-8000-000000000004";

function draft(over: Partial<AccountDraft>): AccountDraft {
  return { ...emptyAccountDraft("2026-10-17", "BRL"), ...over };
}

function recorder() {
  const sent: { route: string; body: unknown }[] = [];
  const record = (route: string) => async (req: Request) => {
    sent.push({ route, body: await req.json() });
    return json(201, {});
  };
  const api = testClient(
    "http://test",
    fakeApi({
      "POST /api/v1/transactions": record("transaction"),
      "POST /api/v1/accounts": async (req: Request) => {
        sent.push({ route: "account", body: await req.json() });
        return json(201, { id: cash });
      },
      [`GET /api/v1/accounts/${created}`]: () =>
        json(200, { id: created, institution_id: institution }),
      "GET /api/v1/accounts": () =>
        json(200, { items: [{ id: cash, parent_id: created, name: "Cash" }] }),
      [`POST /api/v1/accounts/${created}/billing-cycle-rules`]: record("rule"),
      [`POST /api/v1/accounts/${created}/credit-limits`]: record("limit"),
      [`POST /api/v1/accounts/${created}/cards`]: record("card"),
      [`PUT /api/v1/accounts/${created}/card-face`]: record("face"),
      [`GET /api/v1/accounts/${created}/statement-placement`]: () =>
        json(200, {
          reference: "2026-11",
          closing_date: "2026-10-25",
          due_date: "2026-11-05",
        }),
    }),
  );
  return { api, sent };
}

const cardSetup: AccountDraft["card"] = {
  closingMode: "day",
  closingDay: 25,
  closingDaysBeforeDue: null,
  dueDay: 5,
  closingAdjustment: "none",
  dueDateAdjustment: "following",
  assignment: "next",
  limit: 800000,
  cards: [
    { holder: "Ana", lastFour: "1234", virtual: false, network: null },
    { holder: "Ana", lastFour: "9876", virtual: true, network: null },
  ],
  face: emptyFace,
};

const card: Partial<AccountDraft> = {
  kind: "credit_card",
  name: "Itaú Visa",
  card: cardSetup,
  opening: 110000,
};

describe("accountInput", () => {
  it("takes the class from the kind and yields only when the kind can", () => {
    expect(
      accountInput(
        draft({
          kind: "reserve",
          name: " Reserva ",
          yieldAuto: true,
          color: 3,
        }),
      ),
    ).toEqual({
      name: "Reserva",
      class: "asset",
      kind: "reserve",
      currency: "BRL",
      opened_on: "2026-10-17",
      yield_mode: "auto",
      color: 3,
    });
    expect(
      accountInput(draft({ kind: "checking", name: "Nubank", yieldAuto: true }))
        .yield_mode,
    ).toBe("none");
    expect(accountInput(draft(card)).class).toBe("liability");
  });

  it("leaves a brokerage without a parent", () => {
    expect(
      accountInput(draft({ kind: "brokerage", name: "XP", parentId: created }))
        .parent_id,
    ).toBeUndefined();
  });
});

describe("createAccountSteps", () => {
  it("records a checking account's opening balance against Opening balances (S23)", async () => {
    const steps = createAccountSteps(
      draft({ kind: "checking", name: "Nubank", opening: 124055 }),
      { openingBalances: opening, cashName: "Cash" },
    );
    expect(steps.map((s) => s.key)).toEqual(["opening"]);
    const { api, sent } = recorder();
    for (const step of steps) await step.run(api, created);
    expect(sent).toEqual([
      {
        route: "transaction",
        body: {
          date: "2026-10-17",
          postings: [
            {
              account_id: created,
              amount: { amount: 124055, currency: "BRL" },
            },
            {
              account_id: opening,
              amount: { amount: -124055, currency: "BRL" },
            },
          ],
        },
      },
    ]);
  });

  it("sets up a card: billing cycle, limit, its cards and what it owes on the open statement", async () => {
    const steps = createAccountSteps(draft(card), {
      openingBalances: opening,
      cashName: "Cash",
    });
    expect(steps.map((s) => s.key)).toEqual([
      "rule",
      "limit",
      "card",
      "card",
      "opening",
    ]);
    const { api, sent } = recorder();
    for (const step of steps) await step.run(api, created);
    expect(sent).toEqual([
      {
        route: "rule",
        body: {
          effective_from: "2026-10",
          closing_mode: "day",
          closing_day: 25,
          due_day: 5,
          closing_adjustment: "none",
          due_date_adjustment: "following",
          closing_day_assignment: "next",
        },
      },
      {
        route: "limit",
        body: {
          effective_from: "2026-10-17",
          amount: { amount: 800000, currency: "BRL" },
        },
      },
      {
        route: "card",
        body: { holder: "Ana", last_four: "1234", virtual: false },
      },
      {
        route: "card",
        body: { holder: "Ana", last_four: "9876", virtual: true },
      },
      {
        route: "transaction",
        body: {
          date: "2026-10-17",
          postings: [
            {
              account_id: created,
              amount: { amount: -110000, currency: "BRL" },
              statement: "2026-11",
            },
            {
              account_id: opening,
              amount: { amount: 110000, currency: "BRL" },
            },
          ],
        },
      },
    ]);
  });

  it("sends the network of a plastic card that has one", async () => {
    const steps = createAccountSteps(
      draft({
        ...card,
        card: {
          ...cardSetup,
          limit: 0,
          cards: [
            {
              holder: "Ana",
              lastFour: "1234",
              virtual: false,
              network: "visa",
            },
          ],
        },
        opening: 0,
      }),
      { openingBalances: opening, cashName: "Cash" },
    );
    const { api, sent } = recorder();
    for (const step of steps) await step.run(api, created);

    expect(sent[1]).toEqual({
      route: "card",
      body: {
        holder: "Ana",
        last_four: "1234",
        virtual: false,
        network: "visa",
      },
    });
  });

  it("sets the card's appearance after its cards, only when one is chosen", async () => {
    const plain = createAccountSteps(draft(card), {
      openingBalances: opening,
      cashName: "Cash",
    });
    expect(plain.map((s) => s.key)).not.toContain("face");

    const steps = createAccountSteps(
      draft({
        ...card,
        card: { ...cardSetup, face: { ...emptyFace, color: "#fce300" } },
      }),
      { openingBalances: opening, cashName: "Cash" },
    );
    expect(steps.map((s) => s.key)).toEqual([
      "rule",
      "limit",
      "card",
      "card",
      "face",
      "opening",
    ]);

    const { api, sent } = recorder();
    await steps[4]?.run(api, created);
    expect(sent).toEqual([
      {
        route: "face",
        body: {
          color: "#fce300",
          art: null,
          chip: null,
          orientation: null,
          brand: null,
        },
      },
    ]);
  });

  it("skips the opening balance and the limit when they are zero", () => {
    const steps = createAccountSteps(
      draft({
        ...card,
        opening: 0,
        card: { ...cardSetup, limit: 0, cards: [] },
      }),
      { openingBalances: opening, cashName: "Cash" },
    );
    expect(steps.map((s) => s.key)).toEqual(["rule"]);
  });

  it("creates a brokerage's cash account and records the opening balance in it (S391)", async () => {
    const steps = createAccountSteps(
      draft({ kind: "brokerage", name: "XP", opening: 50000 }),
      { openingBalances: opening, cashName: "Cash" },
    );
    expect(steps.map((s) => s.key)).toEqual(["cash", "opening"]);
    const { api, sent } = recorder();
    for (const step of steps) await step.run(api, created);
    expect(sent).toEqual([
      {
        route: "account",
        body: {
          name: "Cash",
          class: "asset",
          kind: "brokerage",
          currency: "BRL",
          opened_on: "2026-10-17",
          institution_id: institution,
          parent_id: created,
          yield_mode: "none",
        },
      },
      {
        route: "transaction",
        body: {
          date: "2026-10-17",
          postings: [
            {
              account_id: cash,
              amount: { amount: 50000, currency: "BRL" },
            },
            {
              account_id: opening,
              amount: { amount: -50000, currency: "BRL" },
            },
          ],
        },
      },
    ]);
  });

  it("finds the cash account again when only the opening balance is left", async () => {
    const steps = createAccountSteps(
      draft({ kind: "brokerage", name: "XP", opening: 50000 }),
      { openingBalances: opening, cashName: "Cash" },
    );
    const { api, sent } = recorder();
    await steps[1]?.run(api, created);
    expect(sent.map((s) => s.route)).toEqual(["transaction"]);
    expect(JSON.stringify(sent[0]?.body)).toContain(cash);
  });

  it("creates the cash account of a brokerage without an opening balance", () => {
    const steps = createAccountSteps(draft({ kind: "brokerage", name: "XP" }), {
      openingBalances: opening,
      cashName: "Cash",
    });
    expect(steps.map((s) => s.key)).toEqual(["cash"]);
  });

  // BC16: money paid from an account of the institution has no cash account and no opening.
  it("creates no cash account and no opening balance when the money stays in the institution", () => {
    const steps = createAccountSteps(
      draft({
        kind: "brokerage",
        name: "Inter",
        opening: 50000,
        cashMode: "institution",
      }),
      { openingBalances: opening, cashName: "Cash" },
    );
    expect(steps).toEqual([]);
  });
});
