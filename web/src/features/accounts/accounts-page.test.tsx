import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import type { components } from "@/api/schema.gen";
import { catalogPtBR } from "@/i18n/catalog.pt-BR";
import { writeLocale } from "@/i18n/locale";
import { fakeApi, json, problem } from "@/testing/fake-api";
import { renderApp } from "@/testing/render-app";

type Account = components["schemas"]["Account"];

beforeEach(() => {
  localStorage.clear();
  writeLocale("pt-BR");
});

function account(over: Partial<Account> & Pick<Account, "id" | "name">) {
  return {
    class: "asset",
    currency: "BRL",
    opened_on: "2026-01-01",
    yield_mode: "none",
    ...over,
  } satisfies Account;
}

const accounts: Account[] = [
  account({ id: "a-checking", name: "Itaú", kind: "checking" }),
  account({
    id: "a-savings",
    name: "Reserva",
    kind: "savings",
    parent_id: "a-checking",
  }),
  account({ id: "a-wallet", name: "Carteira", kind: "wallet" }),
  account({
    id: "a-card",
    name: "Nubank",
    class: "liability",
    kind: "credit_card",
  }),
  account({ id: "a-food", name: "Mercado", class: "expense" }),
];

const balances = [
  ["a-checking", 123456],
  ["a-savings", 50000],
  ["a-card", -30000],
].map(([account_id, amount]) => ({
  account_id,
  date: "2026-10-17",
  basis: "booked",
  balance: { amount, currency: "BRL" },
}));

interface Captured {
  created: unknown[];
  patched: { id: string; body: unknown }[];
  closed: { id: string; body: unknown }[];
}

function accountsApi(closeResponse?: () => Response) {
  const captured: Captured = { created: [], patched: [], closed: [] };
  const patchPath = /^\/api\/v1\/accounts\/([^/]+)$/;
  const fetch = fakeApi({
    "GET /api/v1/me": () => json(200, { id: 1, email: "a@b.c", role: "admin" }),
    "GET /api/v1/settings": () => json(200, { base_currency: "BRL" }),
    "GET /api/v1/instruments": () =>
      json(200, {
        items: [
          { code: "BRL", type: "currency", scale: 2, name: "Real" },
          { code: "USD", type: "currency", scale: 2, name: "Dollar" },
        ],
      }),
    "GET /api/v1/accounts": () => json(200, { items: accounts }),
    "GET /api/v1/balances": () => json(200, { items: balances }),
    "POST /api/v1/accounts": async (req) => {
      captured.created.push(await req.json());
      return json(201, accounts[0]);
    },
    ...Object.fromEntries(
      accounts.flatMap((a) => [
        [
          `PATCH /api/v1/accounts/${a.id}`,
          async (req: Request) => {
            const id = patchPath.exec(new URL(req.url).pathname)?.[1] ?? "";
            captured.patched.push({ id, body: await req.json() });
            return json(200, a);
          },
        ],
        [
          `POST /api/v1/accounts/${a.id}/close`,
          async (req: Request) => {
            captured.closed.push({ id: a.id, body: await req.json() });
            return closeResponse?.() ?? json(200, a);
          },
        ],
      ]),
    ),
  });
  return { fetch, captured };
}

async function openMenu(
  user: ReturnType<typeof userEvent.setup>,
  name: string,
  item: string,
) {
  await user.click(
    await screen.findByRole("button", {
      name: `Ações de ${name}`,
    }),
  );
  await user.click(await screen.findByRole("menuitem", { name: item }));
}

async function pick(
  user: ReturnType<typeof userEvent.setup>,
  name: string,
  option: string,
) {
  await user.click(await screen.findByRole("combobox", { name }));
  await user.click(await screen.findByRole("option", { name: option }));
}

describe("accounts page", () => {
  // Accounts second pass A1: the header states the balance sheet.
  it("states assets, liabilities and net worth in the header", async () => {
    const { fetch } = accountsApi();
    await renderApp("/accounts", { fetch, width: 1280 });
    expect(
      await screen.findByText(
        catalogPtBR["accounts.networth.sub"].replace("{amount}", "R$ 1.434,56"),
      ),
    ).toBeInTheDocument();
    const figures = screen.getByLabelText(catalogPtBR["accounts.figures"]);
    expect(
      [...figures.querySelectorAll("dt")].map((term) => term.textContent),
    ).toEqual([
      catalogPtBR["accounts.class.asset"],
      catalogPtBR["accounts.class.liability"],
      catalogPtBR["accounts.networth"],
    ]);
    expect(within(figures).getByText("R$ 1.734,56")).toBeInTheDocument();
    expect(within(figures).getByText("R$ 300,00")).toBeInTheDocument();
    expect(within(figures).getByText("R$ 1.434,56")).toBeInTheDocument();
  });

  // Accounts second pass A2: balance accounts as a ledger, sub-accounts indented under
  // their parent, liabilities as what is owed, each class closed by its total.
  it("lists the balance accounts with kind and balance, and totals each class", async () => {
    const { fetch } = accountsApi();
    await renderApp("/accounts", { fetch, width: 1280 });
    const assets = await screen.findByRole("table", {
      name: catalogPtBR["accounts.class.asset"],
    });
    const rows = within(assets)
      .getAllByRole("row")
      .slice(1)
      .map((row) => row.textContent.replace(/\u00a0/g, " "));
    expect(rows).toEqual([
      "CarteiraCarteira0,00",
      "ItaúConta corrente1.234,56",
      "ReservaPoupança500,00",
      "Total1.734,56",
    ]);
    expect(
      within(assets).getByRole("link", { name: "Reserva" }).closest("tr"),
    ).toHaveAttribute("data-depth", "1");
    expect(within(assets).getByRole("link", { name: "Itaú" })).toHaveAttribute(
      "href",
      "/accounts/a-checking",
    );
    const liabilities = screen.getByRole("table", {
      name: catalogPtBR["accounts.class.liability"],
    });
    expect(
      within(liabilities).getByRole("link", { name: "Nubank" }),
    ).toHaveAttribute("href", "/cards/a-card");
    expect(liabilities.querySelector("tfoot")?.textContent).toContain("300,00");
  });

  // Accounts second pass A3: categories carry no balance; they read as an index of names.
  it("lists the categories by class without a balance", async () => {
    const { fetch } = accountsApi();
    await renderApp("/accounts", { fetch, width: 1280 });
    const expenses = await screen.findByRole("list", {
      name: catalogPtBR["accounts.class.expense"],
    });
    const food = within(expenses).getByRole("listitem");
    expect(food).toHaveTextContent("Mercado");
    expect(within(food).queryByText(/R\$/)).toBeNull();
  });

  it.each([360, 1280])(
    "keeps the actions of an account in a menu at %i",
    async (width) => {
      const { fetch } = accountsApi();
      const user = userEvent.setup();
      await renderApp("/accounts", { fetch, width });
      await user.click(
        await screen.findByRole("button", { name: "Ações de Nubank" }),
      );
      expect(
        await screen.findByRole("menuitem", {
          name: catalogPtBR["accounts.action.edit"],
        }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("menuitem", {
          name: catalogPtBR["accounts.action.close"],
        }),
      ).toBeInTheDocument();
    },
  );

  it("creates an account with name, class, kind and parent", async () => {
    const user = userEvent.setup();
    const { fetch, captured } = accountsApi();
    await renderApp("/accounts", { fetch });
    await user.click(
      await screen.findByRole("button", { name: catalogPtBR["accounts.new"] }),
    );
    const dialog = await screen.findByRole("dialog");
    await user.type(
      within(dialog).getByRole("textbox", {
        name: catalogPtBR["accounts.field.name"],
      }),
      "Caixa",
    );
    await pick(user, catalogPtBR["accounts.field.kind"], "Dinheiro");
    await user.click(
      within(dialog).getByRole("combobox", {
        name: catalogPtBR["accounts.field.parent"],
      }),
    );
    await user.click(await screen.findByRole("option", { name: "Itaú" }));
    await user.click(
      within(dialog).getByRole("button", {
        name: catalogPtBR["accounts.create.submit"],
      }),
    );
    await waitFor(() => {
      expect(captured.created).toEqual([
        {
          name: "Caixa",
          class: "asset",
          kind: "cash",
          currency: "BRL",
          parent_id: "a-checking",
        },
      ]);
    });
  });

  it("renames an account sending only the name", async () => {
    const user = userEvent.setup();
    const { fetch, captured } = accountsApi();
    await renderApp("/accounts", { fetch });
    await openMenu(user, "Reserva", catalogPtBR["accounts.action.edit"]);
    const dialog = await screen.findByRole("dialog");
    const name = within(dialog).getByRole("textbox", {
      name: catalogPtBR["accounts.field.name"],
    });
    expect(name).toHaveValue("Reserva");
    await user.clear(name);
    await user.type(name, "Reserva 2");
    await user.click(
      within(dialog).getByRole("button", {
        name: catalogPtBR["accounts.edit.submit"],
      }),
    );
    await waitFor(() => {
      expect(captured.patched).toEqual([
        { id: "a-savings", body: { name: "Reserva 2" } },
      ]);
    });
  });

  it("moves an account sending only the parent", async () => {
    const user = userEvent.setup();
    const { fetch, captured } = accountsApi();
    await renderApp("/accounts", { fetch });
    await openMenu(user, "Reserva", catalogPtBR["accounts.action.edit"]);
    const dialog = await screen.findByRole("dialog");
    await user.click(
      within(dialog).getByRole("combobox", {
        name: catalogPtBR["accounts.field.parent"],
      }),
    );
    await user.click(await screen.findByRole("option", { name: "Carteira" }));
    await user.click(
      within(dialog).getByRole("button", {
        name: catalogPtBR["accounts.edit.submit"],
      }),
    );
    await waitFor(() => {
      expect(captured.patched).toEqual([
        { id: "a-savings", body: { parent_id: "a-wallet" } },
      ]);
    });
  });

  it("closes an account on today's date", async () => {
    const user = userEvent.setup();
    const { fetch, captured } = accountsApi();
    await renderApp("/accounts", { fetch, today: "2026-10-17" });
    await openMenu(user, "Mercado", catalogPtBR["accounts.action.close"]);
    const dialog = await screen.findByRole("dialog");
    await user.click(
      within(dialog).getByRole("button", {
        name: catalogPtBR["accounts.close.confirm"],
      }),
    );
    await waitFor(() => {
      expect(captured.closed).toEqual([
        { id: "a-food", body: { closed_on: "2026-10-17" } },
      ]);
    });
  });

  it("shows the account_not_empty message when closing is refused", async () => {
    const user = userEvent.setup();
    const { fetch } = accountsApi(() => problem(409, "account_not_empty"));
    await renderApp("/accounts", { fetch });
    await openMenu(user, "Itaú", catalogPtBR["accounts.action.close"]);
    const dialog = await screen.findByRole("dialog");
    await user.click(
      within(dialog).getByRole("button", {
        name: catalogPtBR["accounts.close.confirm"],
      }),
    );
    expect(
      await within(dialog).findByText(catalogPtBR["problem.account_not_empty"]),
    ).toBeInTheDocument();
  });
});
