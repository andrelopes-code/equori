import { cleanup, screen, waitFor, within } from "@testing-library/react";
import type { ComponentProps } from "react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { components } from "@/api/schema.gen";
import { AccountField } from "@/features/transactions/account-field/account-field";
import { catalogEn } from "@/i18n/catalog.en";
import { catalogPtBR } from "@/i18n/catalog.pt-BR";
import { MASK } from "@/privacy/mask";
import { fakeApi, json } from "@/testing/fake-api";
import { expectNoAmounts, hideAmounts } from "@/testing/privacy";
import { renderApp, renderWithProviders } from "@/testing/render-app";
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

const listbox = () =>
  screen.getByRole("listbox", { name: catalogEn["entry.payWith"] });
const option = (name: string) =>
  within(listbox()).getByRole("option", { name: new RegExp(`^${name}`) });
// The text an option shows, with the no-break spaces of a figure read as spaces.
const text = (row: HTMLElement) => row.textContent.replace(/\u00a0/g, " ");

// The sections of the list: the heading each group is named by and its options in order.
const sectionsShown = () =>
  within(listbox())
    .getAllByRole("group")
    .map((g) => ({
      heading: document.getElementById(g.getAttribute("aria-labelledby") ?? "")
        ?.textContent,
      keys: within(g)
        .getAllByRole("option")
        .map((o) => o.getAttribute("data-key")),
    }));

const trigger = () =>
  screen.getByRole("button", {
    name: new RegExp(`^${catalogEn["entry.payWith"]}`),
  });

// The field opens its accounts in a drawer at every width; the list shows once the balances
// have arrived.
async function openSheet() {
  await userEvent.click(
    await screen.findByRole("button", {
      name: new RegExp(`^${catalogEn["entry.payWith"]}`),
    }),
  );
  await screen.findByRole("dialog", { name: catalogEn["entry.payWith"] });
  return screen.findByRole("listbox", { name: catalogEn["entry.payWith"] });
}

async function typeAmount(digits: string) {
  await userEvent.type(
    await screen.findByRole("textbox", { name: catalogEn["entry.amount"] }),
    digits,
  );
}

async function search(query: string) {
  await userEvent.type(
    screen.getByRole("searchbox", { name: catalogEn["accountChoice.search"] }),
    query,
  );
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

describe("AccountField on a wide screen", () => {
  // D1, D3, R5, R6: one section per consequence, the cards after the accounts, the other
  // kinds in a collapsed block.
  it("lists the sections of an expense, each sorted by name", async () => {
    await renderApp("/transactions/new", { fetch: fakeApi(routes) });
    await openSheet();
    expect(sectionsShown()).toEqual([
      { heading: "Leaves the balance now", keys: [itauID] },
      { heading: "Goes to the statement", keys: [interID, visaID] },
    ]);
    expect(
      screen.getByRole("button", { name: /^Other accounts/ }),
    ).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("option", { name: /^Caixinha/ })).toBeNull();
  });

  // R9, R3: the figure is the balance or the free limit; the fact is the kind or the statement.
  it("states what each account does with the amount", async () => {
    await renderApp("/transactions/new", { fetch: fakeApi(routes) });
    await typeAmount("28640");
    await openSheet();
    await waitFor(() => {
      expect(text(option("Itau"))).toContain("R$4,312.10");
    });
    expect(text(option("Itau"))).toContain("Checking");
    expect(text(option("Itau"))).toContain("balance");
    expect(text(option("Visa"))).toContain("Statement due 11/05");
    expect(text(option("Visa"))).toContain("R$3,157.23");
    expect(text(option("Visa"))).toContain("free");
    expect(option("Inter")).toHaveAttribute("aria-disabled", "true");
    expect(text(option("Inter"))).toContain("R$276.40 short of the limit");
  });

  // R2, D3: a reserve is another account; a search opens its block.
  it("says a reserve leaves the reserve, in the block a search opens", async () => {
    await renderApp("/transactions/new", { fetch: fakeApi(routes) });
    await typeAmount("28640");
    await openSheet();
    await search("Caix");
    await waitFor(() => {
      expect(text(option("Caixinha"))).toContain("leaves the reserve");
    });
    expect(text(option("Caixinha"))).toContain("R$6,950.25");
    expect(
      screen.getByRole("button", { name: /^Other accounts/ }),
    ).toHaveAttribute("aria-expanded", "true");
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
      expect(text(option("Visa"))).toContain("Statement due 11/05");
    });
    expect(text(option("Itau"))).toContain("Checking");
    expect(text(option("Itau"))).not.toContain("R$");
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
      expect(trigger()).toHaveTextContent("Itau");
    });
    expect(status.textContent).toBe("");
    expect(trigger().getAttribute("aria-describedby")).toContain(status.id);
    await openSheet();
    await waitFor(() => {
      expect(option("Visa")).not.toHaveAttribute("aria-disabled");
    });
    await userEvent.click(option("Visa"));
    expect(status.textContent).toBe("Goes on the statement due November 5.");
  });

  // D2: the suggested account moves to the first section, with its reason in the heading.
  it("moves the suggested account to the first section, with the reason", async () => {
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
      expect(sectionsShown()[0]).toEqual({
        heading: "Suggested",
        keys: [visaID],
      });
    });
    expect(
      within(listbox()).getByText("8 of the last 10 in Mercado"),
    ).toBeVisible();
    expect(sectionsShown().slice(1)).toEqual([
      { heading: "Leaves the balance now", keys: [itauID] },
      { heading: "Goes to the statement", keys: [interID] },
    ]);
  });

  it("draws the institution's logo, the goal ring and the meter of a card", async () => {
    await renderApp("/transactions/new", { fetch: fakeApi(routes) });
    await openSheet();
    await waitFor(() => {
      expect(option("Itau").querySelector("img")?.src).toMatch(
        /60701190\.png$/,
      );
    });
    expect(option("Visa")).toHaveAttribute("data-lit", "5");
    await search("Caix");
    const ring = await waitFor(() => {
      const found =
        option("Caixinha").querySelector<HTMLElement>("[data-ring]");
      expect(found).not.toBeNull();
      return found;
    });
    expect(
      ring
        ?.querySelector("circle[stroke-dasharray]")
        ?.getAttribute("stroke-dasharray"),
    ).toBe("42.5 100");
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
    expect(within(sheet).getByRole("separator")).toBeInTheDocument();
    await userEvent.type(
      within(sheet).getByRole("searchbox", {
        name: catalogEn["accountChoice.search"],
      }),
      "vis",
    );
    await waitFor(() => {
      expect(
        within(sheet)
          .getAllByRole("option")
          .map((r) => r.getAttribute("data-key")),
      ).toEqual([visaID]);
    });
    await userEvent.click(within(sheet).getByRole("option"));
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

  it("writes that no account matches a search", async () => {
    await renderApp("/transactions/new", {
      fetch: fakeApi(routes),
      width: 390,
    });
    await openSheet();
    await search("zzz");
    expect(screen.getByText("No account or card matches “zzz”.")).toBeVisible();
  });
});

type Account = components["schemas"]["Account"];

// The twelve accounts of the mock: key, name and kind.
const mockEntries: [string, string, string][] = [
  ["rec", "A receber: Rafael", "receivable"],
  ["ale", "Alelo Refeição", "benefit"],
  ["car", "Carteira", "cash"],
  ["itauc", "Conta corrente Itaú", "checking"],
  ["nubc", "Conta Nubank", "checking"],
  ["itauv", "Itaú Visa Platinum", "credit_card"],
  ["numc", "Nubank Mastercard", "credit_card"],
  ["click", "Itaú Click virtual", "credit_card"],
  ["cx", "Caixinha reserva de emergência", "reserve"],
  ["btc", "mb BTCBRL", "brokerage"],
  ["pou", "Poupança Itaú", "savings"],
  ["xp", "Saldo em conta XP", "brokerage"],
];
const mockID = (key: string) => `m-${key}`;
const mockAccounts = [
  ...mockEntries.map(([key, name, kind]) =>
    kind === "credit_card"
      ? { id: mockID(key), name, ...card(400000) }
      : {
          id: mockID(key),
          name,
          class: "asset",
          kind,
          currency: "BRL",
        },
  ),
  { id: foodID, name: "Mercado", class: "expense", currency: "BRL" },
];

// 7 of the last 10 transactions of Mercado were paid with Nubank Mastercard.
const mockRecent = recent.map((t, i) => ({
  ...t,
  postings: [
    t.postings[0],
    { ...t.postings[1], account_id: mockID(i < 7 ? "numc" : "itauc") },
  ],
}));

const mockRoutes = {
  ...routes,
  "GET /api/v1/accounts": () => json(200, { items: mockAccounts }),
  "GET /api/v1/balances": () =>
    json(200, {
      items: mockAccounts
        .filter((a) => a.class === "asset")
        .map((a) => ({
          account_id: a.id,
          date: "2026-10-17",
          basis: "booked",
          balance: money(500000),
        })),
    }),
  "GET /api/v1/institutions": () => json(200, { items: [] }),
  "GET /api/v1/goals": () => json(200, { items: [] }),
  "GET /api/v1/transactions": (req: Request) =>
    json(200, {
      items:
        new URL(req.url).searchParams.get("account_id") === foodID
          ? mockRecent
          : [],
    }),
  ...Object.fromEntries(
    ["itauv", "numc", "click"].map((key) => [
      `GET /api/v1/accounts/${mockID(key)}/statement-placement`,
      routes[`GET /api/v1/accounts/${visaID}/statement-placement`],
    ]),
  ),
};

function renderField(
  props: Partial<ComponentProps<typeof AccountField>> = {},
  fetchRoutes: Record<
    string,
    (req: Request) => Response | Promise<Response>
  > = mockRoutes,
) {
  const onChange = vi.fn();
  renderWithProviders(
    <AccountField
      accounts={mockAccounts as Account[]}
      value={null}
      onChange={onChange}
      exclude={null}
      name="pay"
      title={catalogPtBR["entry.payWith"]}
      amount={28640}
      direction="out"
      date="2026-10-17"
      categoryId={foodID}
      payeeId={null}
      kind="expense"
      currency="BRL"
      scale={() => 2}
      {...props}
    />,
    { fetch: fakeApi(fetchRoutes) },
  );
  return onChange;
}

const ptList = () =>
  screen.findByRole("listbox", { name: catalogPtBR["entry.payWith"] });
const ptOption = (name: string) =>
  within(screen.getByRole("listbox")).getByRole("option", {
    name: new RegExp(`^${name}`),
  });
const otherBlock = () =>
  screen.getByRole("button", {
    name: new RegExp(`^${catalogPtBR["accountChoice.section.other"]}`),
  });

async function openMockSheet() {
  await userEvent.click(screen.getByRole("button"));
  return ptList();
}

describe("AccountField with the accounts of the mock", () => {
  beforeEach(() => {
    localStorage.setItem(
      "equori.locale",
      JSON.stringify({ language: "pt", region: "BR" }),
    );
  });

  afterEach(() => {
    cleanup();
    localStorage.removeItem("equori.locale");
  });

  // D1 to D3, R6: the first row of the table of sectionsOf, drawn.
  it("lists the sections of an expense by consequence", async () => {
    renderField();
    const list = await openMockSheet();
    await waitFor(() => {
      expect(
        within(list)
          .getAllByRole("group")
          .map(
            (g) =>
              document.getElementById(g.getAttribute("aria-labelledby") ?? "")
                ?.textContent,
          ),
      ).toEqual(["Sugerida", "Sai do saldo agora", "Vai para a fatura"]);
    });
    expect(
      within(list)
        .getAllByRole("group")
        .map((g) =>
          within(g)
            .getAllByRole("option")
            .map((o) => o.getAttribute("data-key")),
        ),
    ).toEqual([
      [mockID("numc")],
      ["itauc", "nubc", "car", "ale"].map(mockID),
      ["click", "itauv"].map(mockID),
    ]);
    expect(otherBlock()).toHaveAttribute("aria-expanded", "false");
    expect(otherBlock()).toHaveTextContent("5");
    expect(
      screen.queryByRole("option", { name: /^Saldo em conta XP/ }),
    ).toBeNull();
    expect(
      list.compareDocumentPosition(otherBlock()) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("writes the reason of the suggestion in its heading", async () => {
    renderField();
    const list = await openMockSheet();

    expect(
      await within(list).findByText("7 das últimas 10 em Mercado"),
    ).toBeVisible();
    expect(
      within(screen.getByRole("group", { name: "Sugerida" })).getByRole(
        "option",
        { name: /^Nubank Mastercard/ },
      ),
    ).toBeVisible();
  });

  it("calls onChange once and closes the sheet on a choice", async () => {
    const onChange = renderField();
    await openMockSheet();
    await waitFor(() => {
      expect(ptOption("Conta Nubank")).toBeVisible();
    });
    await userEvent.click(ptOption("Conta Nubank"));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(mockID("nubc"));
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
  });

  it("draws Contas and Cartões de crédito in a compact field", async () => {
    renderField({ compact: true, amount: 0, categoryId: null });
    const list = await openMockSheet();
    await waitFor(() => {
      expect(
        within(list)
          .getAllByRole("group")
          .map(
            (g) =>
              document.getElementById(g.getAttribute("aria-labelledby") ?? "")
                ?.textContent,
          ),
      ).toEqual(["Contas", "Cartões de crédito"]);
    });
  });

  it("opens the block of other accounts when it holds the chosen account", async () => {
    renderField({ value: mockID("xp") });
    await openMockSheet();

    await waitFor(() => {
      expect(otherBlock()).toHaveAttribute("aria-expanded", "true");
    });
    expect(ptOption("Saldo em conta XP")).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("opens the block of other accounts while a search matches only them", async () => {
    renderField();
    await openMockSheet();
    await userEvent.type(
      screen.getByRole("searchbox", {
        name: catalogPtBR["accountChoice.search"],
      }),
      "xp",
    );

    await waitFor(() => {
      expect(ptOption("Saldo em conta XP")).toBeVisible();
    });
    expect(otherBlock()).toHaveAttribute("aria-expanded", "true");
    expect(screen.getAllByRole("option")).toHaveLength(1);
  });

  it("hides every amount in privacy mode", async () => {
    hideAmounts();
    renderField();
    await openMockSheet();
    await waitFor(() => {
      expect(ptOption("Conta Nubank")).toBeVisible();
    });

    expect(screen.getAllByText(new RegExp(MASK)).length).toBeGreaterThan(0);
    expectNoAmounts(document.body, []);
  });

  it("draws placeholders in place of the list while the balances are pending", async () => {
    renderField(
      {},
      {
        ...mockRoutes,
        "GET /api/v1/balances": () => new Promise<Response>(() => undefined),
      },
    );
    await userEvent.click(screen.getByRole("button"));
    const sheet = await screen.findByRole("dialog", {
      name: catalogPtBR["entry.payWith"],
    });

    await waitFor(() => {
      expect(sheet.querySelector('[aria-busy="true"]')).not.toBeNull();
    });
    expect(within(sheet).queryAllByRole("option")).toHaveLength(0);
  });
});
