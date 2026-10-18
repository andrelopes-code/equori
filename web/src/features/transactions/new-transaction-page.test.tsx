import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { catalogPtBR } from "@/i18n/catalog.pt-BR";
import { writeLocale } from "@/i18n/locale";
import { fakeApi, json, problem } from "@/testing/fake-api";
import { renderApp } from "@/testing/render-app";

const checkingID = "11111111-1111-4111-8111-111111111111";
const foodID = "22222222-2222-4222-8222-222222222222";
const leisureID = "77777777-7777-4777-8777-777777777777";
const savingsID = "88888888-8888-4888-8888-888888888888";
const payeeID = "44444444-4444-4444-8444-444444444444";
const newPayeeID = "66666666-6666-4666-8666-666666666666";

const accounts = [
  {
    id: checkingID,
    name: "Itau",
    class: "asset",
    kind: "checking",
    currency: "BRL",
  },
  { id: foodID, name: "Mercado", class: "expense", currency: "BRL" },
  { id: leisureID, name: "Lazer", class: "expense", currency: "BRL" },
  {
    id: savingsID,
    name: "Reserva",
    class: "asset",
    kind: "savings",
    currency: "BRL",
  },
];

const label = catalogPtBR;

interface Captured {
  transactions: unknown[];
  payees: unknown[];
}

function newApi(
  createResponse?: () => Response,
  accountsRoute?: () => Response | Promise<Response>,
) {
  const captured: Captured = { transactions: [], payees: [] };
  const fetch = fakeApi({
    "GET /api/v1/me": () => json(200, { id: 1, email: "a@b.c", role: "admin" }),
    "GET /api/v1/settings": () => json(200, { base_currency: "BRL" }),
    "GET /api/v1/instruments": () =>
      json(200, {
        items: [{ code: "BRL", type: "currency", scale: 2, name: "Real" }],
      }),
    "GET /api/v1/accounts":
      accountsRoute ?? (() => json(200, { items: accounts })),
    "GET /api/v1/payees": () =>
      json(200, { items: [{ id: payeeID, name: "Padaria" }] }),
    "GET /api/v1/tags": () => json(200, { items: [] }),
    "GET /api/v1/transactions": () => json(200, { items: [] }),
    "POST /api/v1/payees": async (req) => {
      captured.payees.push(await req.json());
      return json(201, { id: newPayeeID, name: "Feira" });
    },
    "POST /api/v1/transactions": async (req) => {
      captured.transactions.push(await req.json());
      return createResponse?.() ?? json(201, { id: "t-1" });
    },
  });
  return { fetch, captured };
}

async function pick(
  user: ReturnType<typeof userEvent.setup>,
  name: string,
  option: string,
) {
  await user.click(await screen.findByRole("combobox", { name }));
  await user.click(await screen.findByRole("option", { name: option }));
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  writeLocale("pt-BR");
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("new transaction", () => {
  it("posts the quick-entry payload and shows a toast", async () => {
    const { fetch, captured } = newApi();
    const user = userEvent.setup();
    await renderApp("/transactions/new", { fetch });
    await user.type(
      await screen.findByRole("spinbutton", {
        name: label["transactions.new.amount"],
      }),
      "120,00",
    );
    await pick(user, label["transactions.new.account"], "Itau");
    await pick(user, label["transactions.new.category"], "Mercado");
    await user.click(
      screen.getByRole("button", { name: label["transactions.new.save"] }),
    );
    await waitFor(() => {
      expect(captured.transactions).toHaveLength(1);
    });
    expect(captured.transactions[0]).toEqual({
      date: "2026-10-17",
      tags: [],
      postings: [
        { account_id: checkingID, amount: { amount: -12000, currency: "BRL" } },
        { account_id: foodID, amount: { amount: 12000, currency: "BRL" } },
      ],
    });
    expect(
      (await screen.findAllByText(label["transactions.new.saved"])).length,
    ).toBeGreaterThan(0);
  });

  it("keeps mode, account and date on save and add another", async () => {
    const { fetch, captured } = newApi();
    const user = userEvent.setup();
    await renderApp("/transactions/new", { fetch });
    await user.type(
      await screen.findByRole("spinbutton", {
        name: label["transactions.new.amount"],
      }),
      "5000",
    );
    await pick(user, label["transactions.new.account"], "Itau");
    await pick(user, label["transactions.new.category"], "Mercado");
    await user.click(
      screen.getByRole("button", {
        name: label["transactions.new.saveAnother"],
      }),
    );
    await waitFor(() => {
      expect(captured.transactions).toHaveLength(1);
    });
    await waitFor(() => {
      expect(
        screen.getByRole("spinbutton", {
          name: label["transactions.new.amount"],
        }),
      ).toHaveValue("");
    });
    expect(
      screen.getByRole("combobox", { name: label["transactions.new.account"] }),
    ).toHaveValue("Itau");
    expect(
      screen.getByRole("combobox", {
        name: label["transactions.new.category"],
      }),
    ).toHaveValue("");
  });

  it("shows a postings error next to the amount", async () => {
    const { fetch } = newApi(() =>
      problem(422, "validation_failed", {
        errors: [{ field: "postings", message: "Postings do not balance" }],
      }),
    );
    const user = userEvent.setup();
    await renderApp("/transactions/new", { fetch });
    await user.type(
      await screen.findByRole("spinbutton", {
        name: label["transactions.new.amount"],
      }),
      "5000",
    );
    await pick(user, label["transactions.new.account"], "Itau");
    await pick(user, label["transactions.new.category"], "Mercado");
    await user.click(
      screen.getByRole("button", { name: label["transactions.new.save"] }),
    );
    expect(
      await screen.findByText("Postings do not balance"),
    ).toBeInTheDocument();
  });

  it("creates a typed payee before the transaction", async () => {
    const { fetch, captured } = newApi();
    const user = userEvent.setup();
    await renderApp("/transactions/new", { fetch });
    await user.type(
      await screen.findByRole("spinbutton", {
        name: label["transactions.new.amount"],
      }),
      "5000",
    );
    await pick(user, label["transactions.new.account"], "Itau");
    await pick(user, label["transactions.new.category"], "Mercado");
    await user.type(
      screen.getByRole("combobox", {
        name: label["transactions.filter.payee"],
      }),
      "Feira",
    );
    await user.click(await screen.findByRole("option", { name: /Feira/ }));
    await user.click(
      screen.getByRole("button", { name: label["transactions.new.save"] }),
    );
    await waitFor(() => {
      expect(captured.transactions).toHaveLength(1);
    });
    expect(captured.payees).toEqual([{ name: "Feira" }]);
    expect(captured.transactions[0]).toMatchObject({ payee_id: newPayeeID });
  });

  it("restores the draft after a remount", async () => {
    const { fetch } = newApi();
    const user = userEvent.setup();
    const first = await renderApp("/transactions/new", { fetch });
    await user.type(
      await screen.findByRole("spinbutton", {
        name: label["transactions.new.amount"],
      }),
      "5000",
    );
    first.unmount();
    await renderApp("/transactions/new", { fetch });
    const restored = await screen.findByRole<HTMLInputElement>("spinbutton", {
      name: label["transactions.new.amount"],
    });
    expect(restored.value.replace(/\s+/g, " ").trim()).toBe("R$ 50,00");
  });

  it("works when sessionStorage throws", async () => {
    const getItem = Storage.prototype.getItem.bind(localStorage);
    const setItem = Storage.prototype.setItem.bind(localStorage);
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(function (
      this: Storage,
      key: string,
    ) {
      if (this === sessionStorage) throw new Error("blocked");
      return getItem(key);
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (
      this: Storage,
      key: string,
      value: string,
    ) {
      if (this === sessionStorage) throw new Error("blocked");
      setItem(key, value);
    });
    const { fetch, captured } = newApi();
    const user = userEvent.setup();
    await renderApp("/transactions/new", { fetch });
    await user.type(
      await screen.findByRole("spinbutton", {
        name: label["transactions.new.amount"],
      }),
      "5000",
    );
    await pick(user, label["transactions.new.account"], "Itau");
    await pick(user, label["transactions.new.category"], "Mercado");
    await user.click(
      screen.getByRole("button", { name: label["transactions.new.save"] }),
    );
    await waitFor(() => {
      expect(captured.transactions).toHaveLength(1);
    });
  });

  it("preselects the account from the URL", async () => {
    const { fetch } = newApi();
    await renderApp(`/transactions/new?account_id=${checkingID}`, { fetch });
    expect(
      await screen.findByRole("combobox", {
        name: label["transactions.new.account"],
      }),
    ).toHaveValue("Itau");
  });

  it("pins the submit button and opens pickers full-screen at 360", async () => {
    const { fetch } = newApi();
    const user = userEvent.setup();
    await renderApp("/transactions/new", { fetch, width: 360 });
    const save = await screen.findByRole("button", {
      name: label["transactions.new.save"],
    });
    expect(save.closest("[data-pinned='true']")).not.toBeNull();
    await user.click(
      screen.getByRole("button", { name: label["transactions.new.account"] }),
    );
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("combobox")).toBeInTheDocument();
  });

  it("renders the pickers inline at 1280", async () => {
    const { fetch } = newApi();
    await renderApp("/transactions/new", { fetch, width: 1280 });
    expect(
      await screen.findByRole("combobox", {
        name: label["transactions.new.account"],
      }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("shows the title and a busy skeleton while the data loads", async () => {
    const { fetch } = newApi(
      undefined,
      () => new Promise<Response>(() => undefined),
    );
    await renderApp("/transactions/new", { fetch });
    expect(
      await screen.findByRole("heading", { name: label["nav.new"] }),
    ).toBeInTheDocument();
    expect(document.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(screen.queryByRole("spinbutton")).toBeNull();
  });

  it("shows an error with retry when the accounts request fails", async () => {
    let failing = true;
    let requests = 0;
    const { fetch } = newApi(undefined, () => {
      requests += 1;
      return failing
        ? problem(500, "internal_error")
        : json(200, { items: accounts });
    });
    const user = userEvent.setup();
    await renderApp("/transactions/new", { fetch });
    const retry = await screen.findByRole("button", {
      name: label["common.retry"],
    });
    expect(screen.getByText(label["common.error.title"])).toBeInTheDocument();
    const before = requests;
    failing = false;
    await user.click(retry);
    expect(
      await screen.findByRole("spinbutton", {
        name: label["transactions.new.amount"],
      }),
    ).toBeInTheDocument();
    expect(requests).toBeGreaterThan(before);
  });

  it("clears the draft after save", async () => {
    const { fetch, captured } = newApi();
    const user = userEvent.setup();
    const first = await renderApp("/transactions/new", { fetch });
    await user.type(
      await screen.findByRole("spinbutton", {
        name: label["transactions.new.amount"],
      }),
      "5000",
    );
    await pick(user, label["transactions.new.account"], "Itau");
    await pick(user, label["transactions.new.category"], "Mercado");
    await user.click(
      screen.getByRole("button", { name: label["transactions.new.save"] }),
    );
    await waitFor(() => {
      expect(captured.transactions).toHaveLength(1);
    });
    first.unmount();
    await renderApp("/transactions/new", { fetch });
    const amount = await screen.findByRole<HTMLInputElement>("spinbutton", {
      name: label["transactions.new.amount"],
    });
    expect(amount.value).toBe("");
  });

  it("splits the amount across categories and blocks save until the remainder is zero", async () => {
    const { fetch, captured } = newApi();
    const user = userEvent.setup();
    await renderApp("/transactions/new", { fetch });
    await user.type(
      await screen.findByRole("spinbutton", {
        name: label["transactions.new.amount"],
      }),
      "10000",
    );
    await pick(user, label["transactions.new.account"], "Itau");
    await pick(user, label["transactions.new.category"], "Mercado");
    await user.click(
      screen.getByRole("button", { name: label["transactions.new.split"] }),
    );
    const save = screen.getByRole("button", {
      name: label["transactions.new.save"],
    });
    expect(screen.getByRole("combobox", { name: "Categoria 1" })).toHaveValue(
      "Mercado",
    );
    expect(screen.getByRole("combobox", { name: "Categoria 2" })).toHaveValue(
      "",
    );
    expect(screen.getByText(/R\$\s*100,00/)).toBeInTheDocument();
    expect(save).toBeDisabled();

    await user.type(
      screen.getByRole("spinbutton", { name: "Valor da categoria 1" }),
      "6000",
    );
    await pick(user, "Categoria 2", "Lazer");
    await user.type(
      screen.getByRole("spinbutton", { name: "Valor da categoria 2" }),
      "2500",
    );
    expect(screen.getByText(/R\$\s*15,00/)).toBeInTheDocument();
    expect(save).toBeDisabled();

    await user.click(
      screen.getByRole("button", { name: label["transactions.new.splitAdd"] }),
    );
    await pick(user, "Categoria 3", "Mercado");
    await user.type(
      screen.getByRole("spinbutton", { name: "Valor da categoria 3" }),
      "1500",
    );
    expect(screen.getByText(/R\$\s*0,00/)).toBeInTheDocument();
    expect(save).toBeEnabled();

    await user.click(save);
    await waitFor(() => {
      expect(captured.transactions).toHaveLength(1);
    });
    expect(captured.transactions[0]).toEqual({
      date: "2026-10-17",
      tags: [],
      postings: [
        {
          account_id: checkingID,
          amount: { amount: -10000, currency: "BRL" },
        },
        { account_id: foodID, amount: { amount: 6000, currency: "BRL" } },
        { account_id: leisureID, amount: { amount: 2500, currency: "BRL" } },
        { account_id: foodID, amount: { amount: 1500, currency: "BRL" } },
      ],
    });
  });

  it("opens the postings editor prefilled and sends the free postings with memo", async () => {
    const { fetch, captured } = newApi();
    const user = userEvent.setup();
    await renderApp("/transactions/new", { fetch });
    await user.type(
      await screen.findByRole("spinbutton", {
        name: label["transactions.new.amount"],
      }),
      "12000",
    );
    await pick(user, label["transactions.new.account"], "Itau");
    await pick(user, label["transactions.new.category"], "Mercado");
    await user.click(
      screen.getByRole("button", { name: label["transactions.new.advanced"] }),
    );
    expect(
      screen.queryByRole("spinbutton", {
        name: label["transactions.new.amount"],
      }),
    ).toBeNull();
    expect(
      screen.getByRole("combobox", { name: "Conta do lançamento 1" }),
    ).toHaveValue("Itau");
    expect(
      screen.getByRole("combobox", { name: "Conta do lançamento 2" }),
    ).toHaveValue("Mercado");
    expect(
      screen.getByRole<HTMLInputElement>("spinbutton", {
        name: "Valor do lançamento 1",
      }).value,
    ).toMatch(/^-R\$\s*120,00$/);
    expect(
      screen.getByRole<HTMLInputElement>("spinbutton", {
        name: "Valor do lançamento 2",
      }).value,
    ).toMatch(/^R\$\s*120,00$/);

    await user.type(
      screen.getByRole("textbox", { name: "Observação do lançamento 2" }),
      "feira",
    );
    await user.click(
      screen.getByRole("button", { name: label["transactions.new.save"] }),
    );
    await waitFor(() => {
      expect(captured.transactions).toHaveLength(1);
    });
    expect(captured.transactions[0]).toEqual({
      date: "2026-10-17",
      tags: [],
      postings: [
        {
          account_id: checkingID,
          amount: { amount: -12000, currency: "BRL" },
        },
        {
          account_id: foodID,
          amount: { amount: 12000, currency: "BRL" },
          memo: "feira",
        },
      ],
    });
  });

  it("shows the imbalance and blocks save while the postings do not balance", async () => {
    const { fetch } = newApi();
    const user = userEvent.setup();
    await renderApp("/transactions/new", { fetch });
    await user.type(
      await screen.findByRole("spinbutton", {
        name: label["transactions.new.amount"],
      }),
      "12000",
    );
    await pick(user, label["transactions.new.account"], "Itau");
    await pick(user, label["transactions.new.category"], "Mercado");
    await user.click(
      screen.getByRole("button", { name: label["transactions.new.advanced"] }),
    );
    const second = screen.getByRole("spinbutton", {
      name: "Valor do lançamento 2",
    });
    await user.clear(second);
    await user.type(second, "13000");
    expect(screen.getByText(/^R\$\s*10,00$/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: label["transactions.new.save"] }),
    ).toBeDisabled();

    await user.click(
      screen.getByRole("button", {
        name: label["transactions.new.postingAdd"],
      }),
    );
    await pick(user, "Conta do lançamento 3", "Reserva");
    const third = screen.getByRole<HTMLInputElement>("spinbutton", {
      name: "Valor do lançamento 3",
    });
    await user.type(third, "-1000");
    expect(third.value).toMatch(/^-R\$\s*10,00$/);
    expect(screen.queryByText(/Diferença/)).toBeNull();
    expect(
      screen.getByRole("button", { name: label["transactions.new.save"] }),
    ).toBeEnabled();
  });

  async function fillQuick(user: ReturnType<typeof userEvent.setup>) {
    await user.type(
      await screen.findByRole("spinbutton", {
        name: label["transactions.new.amount"],
      }),
      "5000",
    );
    await pick(user, label["transactions.new.account"], "Itau");
    await pick(user, label["transactions.new.category"], "Mercado");
  }

  it("reuses a created payee when the transaction request is retried", async () => {
    let calls = 0;
    const { fetch, captured } = newApi(() => {
      calls += 1;
      return calls === 1
        ? problem(500, "internal_error")
        : json(201, { id: "t-1" });
    });
    const user = userEvent.setup();
    await renderApp("/transactions/new", { fetch });
    await fillQuick(user);
    await user.type(
      screen.getByRole("combobox", {
        name: label["transactions.filter.payee"],
      }),
      "Feira",
    );
    await user.click(await screen.findByRole("option", { name: /Feira/ }));
    const save = screen.getByRole("button", {
      name: label["transactions.new.save"],
    });
    await user.click(save);
    await waitFor(() => {
      expect(captured.transactions).toHaveLength(1);
    });
    await waitFor(() => {
      expect(save).toBeEnabled();
    });
    await user.click(save);
    await waitFor(() => {
      expect(captured.transactions).toHaveLength(2);
    });
    expect(captured.payees).toEqual([{ name: "Feira" }]);
    expect(captured.transactions[1]).toMatchObject({ payee_id: newPayeeID });
  });

  it("attaches a mapped field error to its field, shows others form-level and clears on edit", async () => {
    let body: unknown = {
      errors: [{ field: "description", message: "Description too long" }],
    };
    const { fetch } = newApi(() =>
      problem(422, "validation_failed", body as Record<string, unknown>),
    );
    const user = userEvent.setup();
    await renderApp("/transactions/new", { fetch });
    await fillQuick(user);
    const save = screen.getByRole("button", {
      name: label["transactions.new.save"],
    });
    await user.click(save);
    expect(await screen.findByText("Description too long")).toBeInTheDocument();
    expect(screen.queryByText(label["problem.validation_failed"])).toBeNull();
    await user.type(
      screen.getByRole("textbox", {
        name: label["transactions.new.description"],
      }),
      "x",
    );
    expect(screen.queryByText("Description too long")).toBeNull();
    body = { errors: [{ field: "tags[0]", message: "Tag invalid" }] };
    await user.click(save);
    expect(
      await screen.findByText(label["problem.validation_failed"]),
    ).toBeInTheDocument();
    expect(screen.queryByText("Tag invalid")).toBeNull();
  });

  it("shows a form-level error when the request fails without a problem", async () => {
    const { fetch } = newApi(() => {
      throw new TypeError("network down");
    });
    const user = userEvent.setup();
    await renderApp("/transactions/new", { fetch });
    await fillQuick(user);
    await user.click(
      screen.getByRole("button", { name: label["transactions.new.save"] }),
    );
    expect(
      await screen.findByText(label["transactions.new.failed"]),
    ).toBeInTheDocument();
  });

  it("ignores a second submit while the save is pending", async () => {
    let release: (response: Response) => void = () => undefined;
    const { fetch, captured } = newApi(
      () =>
        new Promise<Response>((resolve) => {
          release = resolve;
        }) as unknown as Response,
    );
    const user = userEvent.setup();
    await renderApp("/transactions/new", { fetch });
    await fillQuick(user);
    const save = screen.getByRole("button", {
      name: label["transactions.new.save"],
    });
    const form = save.closest("form");
    if (form === null) throw new Error("form not found");
    await user.click(save);
    await waitFor(() => {
      expect(captured.transactions).toHaveLength(1);
    });
    fireEvent.submit(form);
    fireEvent.submit(form);
    release(json(201, { id: "t-1" }));
    await screen.findAllByText(label["transactions.new.saved"]);
    expect(captured.transactions).toHaveLength(1);
  });

  it("restores a split draft with its lines and remainder", async () => {
    const { fetch } = newApi();
    const user = userEvent.setup();
    const first = await renderApp("/transactions/new", { fetch });
    await user.type(
      await screen.findByRole("spinbutton", {
        name: label["transactions.new.amount"],
      }),
      "10000",
    );
    await pick(user, label["transactions.new.account"], "Itau");
    await pick(user, label["transactions.new.category"], "Mercado");
    await user.click(
      screen.getByRole("button", { name: label["transactions.new.split"] }),
    );
    await user.type(
      screen.getByRole("spinbutton", { name: "Valor da categoria 1" }),
      "6000",
    );
    first.unmount();
    await renderApp("/transactions/new", { fetch });
    expect(
      await screen.findByRole("combobox", { name: "Categoria 1" }),
    ).toHaveValue("Mercado");
    expect(
      screen.getByRole<HTMLInputElement>("spinbutton", {
        name: "Valor da categoria 1",
      }).value,
    ).toMatch(/^R\$\s*60,00$/);
    expect(screen.getByText(/^R\$\s*40,00$/)).toBeInTheDocument();
  });

  it("restores an advanced draft with its postings and imbalance", async () => {
    const { fetch } = newApi();
    const user = userEvent.setup();
    const first = await renderApp("/transactions/new", { fetch });
    await user.type(
      await screen.findByRole("spinbutton", {
        name: label["transactions.new.amount"],
      }),
      "12000",
    );
    await pick(user, label["transactions.new.account"], "Itau");
    await pick(user, label["transactions.new.category"], "Mercado");
    await user.click(
      screen.getByRole("button", { name: label["transactions.new.advanced"] }),
    );
    const second = screen.getByRole("spinbutton", {
      name: "Valor do lançamento 2",
    });
    await user.clear(second);
    await user.type(second, "13000");
    first.unmount();
    await renderApp("/transactions/new", { fetch });
    expect(
      await screen.findByRole("combobox", { name: "Conta do lançamento 2" }),
    ).toHaveValue("Mercado");
    expect(
      screen.getByRole<HTMLInputElement>("spinbutton", {
        name: "Valor do lançamento 2",
      }).value,
    ).toMatch(/^R\$\s*130,00$/);
    expect(screen.getByText(/^R\$\s*10,00$/)).toBeInTheDocument();
  });

  it.each([
    ["split", { split: [{}], postings: null }],
    ["postings", { split: null, postings: [{ key: 1, amount: "x" }] }],
    ["top-level amount", { split: null, postings: null, amount: 1.5 }],
    [
      "amount",
      {
        split: [{ key: "1", categoryId: "", amount: 1.5 }],
        postings: null,
      },
    ],
  ])("opens a blank form for a malformed %s draft", async (_name, lines) => {
    sessionStorage.setItem(
      "equori.draft.transaction-new",
      JSON.stringify({
        mode: "expense",
        amount: 10000,
        accountId: checkingID,
        counterId: foodID,
        date: "2026-10-17",
        description: "",
        tags: [],
        ...lines,
      }),
    );
    const { fetch } = newApi();
    await renderApp("/transactions/new", { fetch });
    const amount = await screen.findByRole<HTMLInputElement>("spinbutton", {
      name: label["transactions.new.amount"],
    });
    expect(amount.value).toBe("");
    expect(
      screen.getByRole("combobox", { name: label["transactions.new.account"] }),
    ).toHaveValue("");
  });
});
