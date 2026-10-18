import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { catalogPtBR } from "@/i18n/catalog.pt-BR";
import { writeLocale } from "@/i18n/locale";
import { fakeApi, json } from "@/testing/fake-api";
import { renderApp } from "@/testing/render-app";

const itauID = "11111111-1111-4111-8111-111111111111";
const cardID = "22222222-2222-4222-8222-222222222222";
const restaurantsID = "33333333-3333-4333-8333-333333333333";
const transportID = "44444444-4444-4444-8444-444444444444";
const incomeID = "55555555-5555-4555-8555-555555555555";

const money = (amount: number) => ({ amount, currency: "BRL" });

const accounts = [
  {
    id: itauID,
    name: "Itaú",
    class: "asset",
    kind: "checking",
    currency: "BRL",
  },
  {
    id: cardID,
    name: "Nubank",
    class: "liability",
    kind: "credit_card",
    currency: "BRL",
  },
  {
    id: restaurantsID,
    name: "Restaurantes",
    class: "expense",
    currency: "BRL",
  },
  { id: transportID, name: "Transporte", class: "expense", currency: "BRL" },
  { id: incomeID, name: "Renda", class: "income", currency: "BRL" },
];

function entryApi() {
  const posted: unknown[] = [];
  const voided: unknown[] = [];
  const fetch = fakeApi({
    "GET /api/v1/me": () => json(200, { id: 1, email: "a@b.c", role: "admin" }),
    "GET /api/v1/settings": () => json(200, { base_currency: "BRL" }),
    "GET /api/v1/instruments": () =>
      json(200, {
        items: [{ code: "BRL", type: "currency", scale: 2, name: "Real" }],
      }),
    "GET /api/v1/accounts": () => json(200, { items: accounts }),
    "GET /api/v1/balances": () =>
      json(200, {
        items: [
          { account_id: itauID, balance: money(100000) },
          { account_id: cardID, balance: money(-20000) },
        ],
      }),
    "GET /api/v1/payees": () => json(200, { items: [] }),
    "GET /api/v1/tags": () => json(200, { items: [] }),
    "GET /api/v1/transactions": () => json(200, { items: [] }),
    "POST /api/v1/transactions": async (req) => {
      const body: unknown = await req.json();
      posted.push(body);
      return json(201, {
        id: "tx-new",
        date: "2026-10-16",
        description: "Almoço",
        balancing_currency: "BRL",
        origin: "manual",
        version: 1,
        tags: [],
        links: [],
        postings: [],
      });
    },
    "POST /api/v1/transactions/tx-new/void": async (req) => {
      voided.push(await req.json());
      return json(200, {
        id: "tx-new",
        date: "2026-10-16",
        description: "Almoço",
        balancing_currency: "BRL",
        origin: "manual",
        version: 2,
        voided_at: "2026-10-17T10:00:00Z",
        tags: [],
        links: [],
        postings: [],
      });
    },
  });
  return { fetch, posted, voided };
}

const label = catalogPtBR;

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  writeLocale("pt-BR");
});

async function openEntry(width = 1280) {
  const api = entryApi();
  const user = userEvent.setup();
  const view = await renderApp("/", { fetch: api.fetch, width });
  await user.keyboard("n");
  const dialog = await screen.findByRole("dialog", {
    name: label["entry.title"],
  });
  const field = within(dialog).getByRole("textbox", {
    name: label["entry.field"],
  });
  return { ...api, ...view, user, dialog, field };
}

const preview = (dialog: HTMLElement, term: keyof typeof label) =>
  within(dialog)
    .getByText(label[term], { selector: "dt" })
    .nextElementSibling?.textContent.replace(/\u00a0/g, " ");

// Complete frontend F2.
describe("quick entry", () => {
  it("opens on N and reads amount, date, account, category and description from the text", async () => {
    const { dialog, field, user } = await openEntry();
    expect(field).toHaveFocus();
    await user.type(field, "almoço 42 ontem");
    await waitFor(() => {
      expect(preview(dialog, "entry.amount")).toBe("R$ 42,00");
    });
    expect(preview(dialog, "entry.description")).toBe("Almoço");
    expect(preview(dialog, "entry.when")).toBe("Ontem, 16 out");
    expect(preview(dialog, "entry.account")).toBe("Itaú");
    expect(
      within(dialog).getByRole("button", { name: "Restaurantes" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      within(dialog).getByRole("button", { name: "Transporte" }),
    ).toHaveAttribute("aria-pressed", "false");
    expect(within(dialog).getByText("Itaú fica com R$ 958,00.")).toBeVisible();
  });

  it("posts the parsed transaction on Enter, closes, and voids it from the toast's Undo", async () => {
    const { field, user, posted, voided } = await openEntry();
    await user.type(field, "almoço 42 ontem{Enter}");
    await waitFor(() => {
      expect(posted).toHaveLength(1);
    });
    expect(posted[0]).toEqual({
      date: "2026-10-16",
      description: "Almoço",
      tags: [],
      postings: [
        { account_id: itauID, amount: money(-4200) },
        { account_id: restaurantsID, amount: money(4200) },
      ],
    });
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
    const [toast] = await screen.findAllByText("Lançado: Almoço, R$ 42,00", {
      selector: '[data-ui="toast"] *',
    });
    const undo = within(
      toast?.closest<HTMLElement>('[data-ui="toast"]') ?? document.body,
    ).getByRole("button", { name: label["entry.undo"] });
    await user.click(undo);
    await waitFor(() => {
      expect(voided).toEqual([{ reason: label["entry.undo.reason"] }]);
    });
  });

  it("takes a category chosen by hand over the suggestion", async () => {
    const { dialog, field, user, posted } = await openEntry();
    await user.type(field, "uber 23,90 cartão");
    await user.click(
      within(dialog).getByRole("button", { name: "Restaurantes" }),
    );
    expect(
      within(dialog).getByRole("button", { name: "Restaurantes" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(preview(dialog, "entry.account")).toBe("Nubank");
    await user.click(
      within(dialog).getByRole("button", { name: label["entry.post"] }),
    );
    await waitFor(() => {
      expect(posted).toHaveLength(1);
    });
    expect(posted[0]).toEqual({
      date: "2026-10-17",
      description: "Uber",
      tags: [],
      postings: [
        { account_id: cardID, amount: money(-2390) },
        { account_id: restaurantsID, amount: money(2390) },
      ],
    });
  });

  it("offers income categories for income and posts money in", async () => {
    const { dialog, field, user, posted } = await openEntry();
    await user.type(field, "recebi freela 1200");
    expect(
      within(dialog).getByRole("button", { name: "Renda" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      within(dialog).queryByRole("button", { name: "Restaurantes" }),
    ).toBeNull();
    await user.keyboard("{Enter}");
    await waitFor(() => {
      expect(posted).toHaveLength(1);
    });
    expect(posted[0]).toEqual({
      date: "2026-10-17",
      description: "Freela",
      tags: [],
      postings: [
        { account_id: itauID, amount: money(120000) },
        { account_id: incomeID, amount: money(-120000) },
      ],
    });
  });

  it("asks for the amount instead of posting without one", async () => {
    const { dialog, field, user, posted } = await openEntry();
    await user.type(field, "almoço{Enter}");
    expect(within(dialog).getByText(label["entry.missing"])).toBeVisible();
    expect(posted).toHaveLength(0);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("carries the parse into the full form", async () => {
    const { dialog, field, user, router } = await openEntry();
    await user.type(field, "almoço 42 ontem");
    await user.click(
      within(dialog).getByRole("button", { name: label["entry.more"] }),
    );
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/transactions/new");
    });
    const amount = await screen.findByRole<HTMLInputElement>("textbox", {
      name: label["transactions.new.amount"],
    });
    await waitFor(() => {
      expect(amount.value).toBe("42,00");
    });
  });

  it("fills the whole screen with examples to tap on a phone", async () => {
    const api = entryApi();
    const user = userEvent.setup();
    await renderApp("/", { fetch: api.fetch, width: 360 });
    await user.click(
      within(
        document.querySelector<HTMLElement>('[data-own="bottom-bar"]') ??
          document.body,
      ).getByRole("button", { name: label["nav.entry"] }),
    );
    const dialog = await screen.findByRole("dialog", {
      name: label["entry.title"],
    });
    expect(dialog.closest('[data-ui="dialog"]')).toHaveAttribute(
      "data-full-screen",
      "always",
    );
    await user.click(
      within(dialog).getByRole("button", { name: "uber 23,90 cartão" }),
    );
    expect(
      within(dialog).getByRole("textbox", { name: label["entry.field"] }),
    ).toHaveValue("uber 23,90 cartão");
  });
});
