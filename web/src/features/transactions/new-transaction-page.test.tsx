import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { catalogPtBR } from "@/i18n/catalog.pt-BR";
import { writeLocale } from "@/i18n/locale";
import { fakeApi, json, problem } from "@/testing/fake-api";
import { renderApp } from "@/testing/render-app";

const checkingID = "11111111-1111-4111-8111-111111111111";
const foodID = "22222222-2222-4222-8222-222222222222";
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
});
