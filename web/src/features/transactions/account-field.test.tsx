import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { catalogEn } from "@/i18n/catalog.en";
import { fakeApi, json } from "@/testing/fake-api";
import { renderApp } from "@/testing/render-app";
import { foodID, sharedRoutes } from "@/testing/transaction-api";

const itauID = "a1111111-1111-4111-8111-111111111111";
const visaID = "a2222222-2222-4222-8222-222222222222";
const interID = "a3333333-3333-4333-8333-333333333333";
const caixinhaID = "a4444444-4444-4444-8444-444444444444";
const itauInstitution = "b1111111-1111-4111-8111-111111111111";
const money = (amount: number) => ({ amount, currency: "BRL" });
const card = (available: number) => ({
  class: "liability",
  kind: "credit_card",
  currency: "BRL",
  card: { credit_limit: money(500000), available_limit: money(available) },
});

const accounts = [
  {
    id: itauID,
    name: "Itau",
    class: "asset",
    kind: "checking",
    currency: "BRL",
    institution_id: itauInstitution,
  },
  { id: visaID, name: "Visa", ...card(315723) },
  { id: interID, name: "Inter", ...card(1000) },
  {
    id: caixinhaID,
    name: "Caixinha",
    class: "asset",
    kind: "reserve",
    currency: "BRL",
    yield_mode: "auto",
  },
  { id: foodID, name: "Mercado", class: "expense", currency: "BRL" },
];

// 8 of the last 10 transactions of Mercado were paid with Visa.
const recent = Array.from({ length: 10 }, (_, i) => ({
  id: `t${String(i)}`,
  date: "2026-10-01",
  description: "Mercado",
  balancing_currency: "BRL",
  origin: "manual",
  version: 1,
  tags: [],
  links: [],
  postings: [
    { id: `p${String(i)}`, account_id: foodID, amount: money(1000) },
    {
      id: `q${String(i)}`,
      account_id: i < 8 ? visaID : itauID,
      amount: money(-1000),
    },
  ],
}));

const routes = {
  ...sharedRoutes,
  "GET /api/v1/accounts": () => json(200, { items: accounts }),
  "GET /api/v1/balances": () =>
    json(200, {
      items: [
        {
          account_id: itauID,
          date: "2026-10-17",
          basis: "booked",
          balance: money(431210),
        },
        {
          account_id: caixinhaID,
          date: "2026-10-17",
          basis: "booked",
          balance: money(695025),
        },
      ],
    }),
  "GET /api/v1/institutions": () =>
    json(200, {
      items: [
        {
          id: itauInstitution,
          name: "Itaú",
          identifier: { scheme: "br_ispb", identifier: "60701190" },
        },
      ],
    }),
  "GET /api/v1/goals": () =>
    json(200, {
      items: [
        {
          id: "g1",
          name: "Viagem",
          target: money(1000000),
          due_on: "2027-06-01",
          account_ids: [caixinhaID],
          current: money(425000),
          remaining: money(575000),
          progress_bp: 4250,
        },
      ],
    }),
  [`GET /api/v1/accounts/${visaID}/statement-placement`]: () =>
    json(200, {
      reference: "2026-11",
      closing_date: "2026-10-29",
      due_date: "2026-11-05",
      previous_closing_date: "2026-09-29",
      previous_due_date: "2026-10-05",
    }),
  "GET /api/v1/transactions": (req: Request) =>
    json(200, {
      items:
        new URL(req.url).searchParams.get("account_id") === foodID
          ? recent
          : [],
    }),
};

const group = () =>
  screen.getByRole("radiogroup", { name: catalogEn["entry.payWith"] });
const option = (name: string) =>
  within(group()).getByRole("radio", { name: new RegExp(`^${name}`) });
// The radio-group item around an option's input: its circle, its label and its mark.
const item = (radio: HTMLElement) => radio.closest('[data-part="item"]');
// The text an option shows, with the no-break spaces of a figure read as spaces.
const text = (radio: HTMLElement) =>
  (item(radio)?.textContent ?? "").replace(/\u00a0/g, " ");

// The figure on an option's right, the third part of its row after the mark and the text: its
// label and value read as one phrase.
const figure = (radio: HTMLElement) =>
  Array.from(
    item(radio)?.querySelector("label")?.firstElementChild?.children[2]
      ?.children ?? [],
  )
    .map((c) => c.textContent.replace(/\u00a0/g, " "))
    .join(" ");

const trigger = () =>
  screen.getByRole("button", {
    name: new RegExp(`^${catalogEn["entry.payWith"]}`),
  });

// The field opens its accounts in a drawer at every width.
async function openSheet() {
  await userEvent.click(
    await screen.findByRole("button", {
      name: new RegExp(`^${catalogEn["entry.payWith"]}`),
    }),
  );
  return screen.findByRole("dialog", { name: catalogEn["entry.payWith"] });
}

async function typeAmount(digits: string) {
  await userEvent.type(
    await screen.findByRole("textbox", { name: catalogEn["entry.amount"] }),
    digits,
  );
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

describe("AccountField on a wide screen", () => {
  it("lists the groups in their fixed order, each sorted by name", async () => {
    await renderApp("/transactions/new", { fetch: fakeApi(routes) });
    await openSheet();
    expect(
      within(group())
        .getAllByRole("radio")
        .map((r) => r.getAttribute("value")),
    ).toEqual([itauID, interID, visaID, caixinhaID]);
    expect(
      within(group())
        .getAllByText(/^(Accounts|Credit cards|Reserves)$/)
        .map((h) => h.textContent),
    ).toEqual(["Accounts", "Credit cards", "Reserves"]);
  });

  it("states what each account does with the amount", async () => {
    await renderApp("/transactions/new", { fetch: fakeApi(routes) });
    await typeAmount("28640");
    await openSheet();
    await waitFor(() => {
      expect(figure(option("Itau"))).toBe("leaves R$ 4,025.70");
    });
    expect(text(option("Itau"))).toContain("checking · balance R$ 4,312.10");
    expect(figure(option("Visa"))).toBe("statement 11/05");
    expect(text(option("Visa"))).toContain(
      "credit card · free limit R$ 3,157.23",
    );
    expect(figure(option("Caixinha"))).toBe("leaves R$ 6,663.85");
    expect(text(option("Caixinha"))).not.toContain("yield");
    expect(option("Inter")).toBeDisabled();
    expect(figure(option("Inter"))).toBe(
      catalogEn["accountChoice.figure.noFreeLimit"],
    );
  });

  it("shows no consequence the application cannot compute", async () => {
    await renderApp("/transactions/new", {
      fetch: fakeApi({
        ...routes,
        "GET /api/v1/balances": () => json(200, { items: [] }),
      }),
    });
    await typeAmount("28640");
    await openSheet();
    await waitFor(() => {
      expect(figure(option("Visa"))).toBe("statement 11/05");
    });
    expect(figure(option("Itau"))).toBe("");
    expect(text(option("Itau"))).not.toContain("balance R$");
  });

  it("says what the chosen account does, under the field", async () => {
    await renderApp("/transactions/new", { fetch: fakeApi(routes) });
    await typeAmount("28640");
    await openSheet();
    await userEvent.click(option("Itau"));
    const status = await screen.findByRole("status", {
      name: "",
    });
    await waitFor(() => {
      expect(status.textContent.replace(/\u00a0/g, " ")).toBe(
        "The account balance becomes R$ 4,025.70.",
      );
    });
    expect(trigger().getAttribute("aria-describedby")).toContain(status.id);
    await openSheet();
    await waitFor(() => {
      expect(option("Visa")).toBeEnabled();
    });
    await userEvent.click(option("Visa"));
    expect(status.textContent).toBe("Goes on the statement due November 5.");
  });

  it("marks the suggested account where it stands, with the reason", async () => {
    await renderApp("/transactions/new", { fetch: fakeApi(routes) });
    const category = await screen.findByRole("combobox", {
      name: catalogEn["category.label"],
    });
    await userEvent.click(category);
    await userEvent.type(category, "Mercado");
    await waitFor(() => {
      expect(screen.getAllByRole("option").length).toBeGreaterThan(0);
    });
    await userEvent.keyboard("{ArrowDown}{Enter}");
    await openSheet();
    await waitFor(() => {
      expect(text(option("Visa"))).toContain("suggested");
    });
    expect(text(option("Visa"))).toContain(
      "Used in 8 of the last 10 transactions of Mercado.",
    );
    expect(text(option("Itau"))).not.toContain("suggested");
    expect(
      within(group())
        .getAllByRole("radio")
        .map((r) => r.getAttribute("value")),
    ).toEqual([itauID, interID, visaID, caixinhaID]);
  });

  it("draws the institution's logo and the goal ring", async () => {
    await renderApp("/transactions/new", { fetch: fakeApi(routes) });
    await openSheet();
    await waitFor(() => {
      expect(item(option("Itau"))?.querySelector("img")?.src).toMatch(
        /60701190\.png$/,
      );
    });
    const ring = item(option("Caixinha"))?.querySelector<HTMLElement>(
      "[data-ring]",
    );
    await waitFor(() => {
      expect(ring?.style.getPropertyValue("--mark-progress")).toBe("42.5%");
    });
    expect(item(option("Visa"))?.querySelector("[data-shape]")).toHaveAttribute(
      "data-shape",
      "card",
    );
  });
});

describe("AccountField on a phone", () => {
  it("opens a sheet to search and choose, and closes it on the choice", async () => {
    await renderApp("/transactions/new", {
      fetch: fakeApi(routes),
      width: 390,
    });
    await typeAmount("28640");
    const trigger = screen.getByRole("button", {
      name: new RegExp(`^${catalogEn["entry.payWith"]}`),
    });
    expect(trigger.textContent).toContain(catalogEn["accountChoice.choose"]);
    await userEvent.click(trigger);
    const sheet = await screen.findByRole("dialog", {
      name: catalogEn["entry.payWith"],
    });
    expect(within(sheet).getByText("Expense of R$286.40")).toBeVisible();
    await userEvent.type(
      within(sheet).getByRole("searchbox", {
        name: catalogEn["accountChoice.search"],
      }),
      "vis",
    );
    expect(
      within(sheet)
        .getAllByRole("radio")
        .map((r) => r.getAttribute("value")),
    ).toEqual([visaID]);
    await userEvent.click(within(sheet).getByRole("radio"));
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
    expect(trigger.textContent.replace(/\u00a0/g, " ")).toContain(
      "Visacredit card · free limit R$ 3,157.23",
    );
    expect(screen.getByRole("status").textContent).toBe(
      "Goes on the statement due November 5.",
    );
  });
});
