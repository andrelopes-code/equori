import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { catalogPtBR } from "@/i18n/catalog.pt-BR";
import { formatDate, formatMoney } from "@/i18n/format";
import { writeLocale } from "@/i18n/locale";
import { fakeApi, json, problem } from "@/testing/fake-api";
import { renderApp } from "@/testing/render-app";
import {
  leisureID,
  sharedRoutes,
  transactionFixture,
  txID,
} from "@/testing/transaction-api";

const label = catalogPtBR;

function money(amount: number): string {
  return formatMoney({ amount, currency: "BRL" }, 2, "pt-BR").replace(
    /\s+/g,
    " ",
  );
}

interface Captured {
  voids: unknown[];
  categorizes: unknown[];
}

function newApi(initial: Record<string, unknown> = transactionFixture()) {
  const captured: Captured = { voids: [], categorizes: [] };
  let current = initial;
  const fetch = fakeApi({
    ...sharedRoutes,
    [`GET /api/v1/transactions/${txID}`]: () => json(200, current),
    [`POST /api/v1/transactions/${txID}/void`]: async (req) => {
      captured.voids.push(await req.json());
      current = {
        ...current,
        version: 4,
        voided_at: "2026-10-17T12:00:00Z",
        void_reason: "duplicate",
      };
      return json(200, current);
    },
    [`POST /api/v1/transactions/${txID}/categorize`]: async (req) => {
      captured.categorizes.push(await req.json());
      return json(200, { ...current, version: 4 });
    },
    [`GET /api/v1/transactions/${txID}/versions`]: () =>
      json(200, {
        items: [
          {
            version: 2,
            reason: "typo in the amount",
            replaced_at: "2026-10-12T10:00:00Z",
            transaction: current,
          },
          {
            version: 1,
            reason: "first entry",
            replaced_at: "2026-10-11T09:00:00Z",
            transaction: current,
          },
        ],
      }),
  });
  return { fetch, captured };
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  writeLocale("pt-BR");
});

describe("transaction detail", () => {
  it("shows the fields, each posting with its status, the origin and the version", async () => {
    const { fetch } = newApi();
    await renderApp(`/transactions/${txID}`, { fetch });
    expect(await screen.findByText("Weekly shop")).toBeTruthy();
    expect(screen.getByText(formatDate("2026-10-10", "pt-BR"))).toBeTruthy();
    expect(screen.getByText("Padaria")).toBeTruthy();
    expect(screen.getByText("food")).toBeTruthy();
    expect(screen.getByText(label["transaction.origin.manual"])).toBeTruthy();
    expect(screen.getByText("3")).toBeTruthy();
    const postings = within(
      screen.getByRole("list", { name: label["transactions.new.postings"] }),
    );
    const rows = postings.getAllByRole("listitem");
    expect(rows).toHaveLength(2);
    const [first, second] = rows.map((row) => within(row));
    expect(first?.getByText("Itau")).toBeTruthy();
    expect(first?.getByText(money(-12000))).toBeTruthy();
    expect(first?.getByText(label["transaction.status.cleared"])).toBeTruthy();
    expect(second?.getByText("Mercado")).toBeTruthy();
    expect(second?.getByText(label["transaction.status.pending"])).toBeTruthy();
    expect(screen.getAllByText(money(-12000))).toHaveLength(2);
  });

  it("strikes a voided transaction through and shows its reason", async () => {
    const { fetch } = newApi(
      transactionFixture({
        voided_at: "2026-10-12T10:00:00Z",
        void_reason: "duplicate entry",
      }),
    );
    await renderApp(`/transactions/${txID}`, { fetch });
    expect(await screen.findByText("duplicate entry")).toBeTruthy();
    const struck = screen
      .getAllByText(money(-12000))
      .filter((el) => el.closest("s") !== null);
    expect(struck).toHaveLength(1);
    expect(
      screen.queryByRole("button", { name: label["transaction.actions.void"] }),
    ).toBeNull();
  });

  it("voids with a required reason, then shows the voided state and a toast", async () => {
    const { fetch, captured } = newApi();
    const user = userEvent.setup();
    await renderApp(`/transactions/${txID}`, { fetch });
    await user.click(
      await screen.findByRole("button", {
        name: label["transaction.actions.void"],
      }),
    );
    const dialog = within(await screen.findByRole("dialog"));
    const confirm = dialog.getByRole("button", {
      name: label["transaction.void.confirm"],
    });
    expect(confirm.hasAttribute("disabled")).toBe(true);
    await user.type(
      dialog.getByRole("textbox", { name: label["transaction.void.reason"] }),
      "duplicate",
    );
    await user.click(confirm);
    await waitFor(() => {
      expect(captured.voids).toEqual([{ reason: "duplicate" }]);
    });
    expect(await screen.findByText(label["transaction.voided"])).toBeTruthy();
    expect(
      (await screen.findAllByText(label["transaction.void.done"])).length,
    ).toBeGreaterThan(0);
  });

  it("recategorizes with the loaded version and the chosen parts", async () => {
    const { fetch, captured } = newApi();
    const user = userEvent.setup();
    await renderApp(`/transactions/${txID}`, { fetch });
    await user.click(
      await screen.findByRole("button", {
        name: label["transaction.actions.categorize"],
      }),
    );
    const dialog = within(await screen.findByRole("dialog"));
    await user.click(
      await dialog.findByRole("combobox", {
        name: label["transactions.new.splitCategory"].replace("{n}", "1"),
      }),
    );
    await user.click(await screen.findByRole("option", { name: "Lazer" }));
    await user.click(
      dialog.getByRole("button", {
        name: label["transaction.categorize.save"],
      }),
    );
    await waitFor(() => {
      expect(captured.categorizes).toEqual([
        {
          expected_version: 3,
          parts: [
            {
              account_id: leisureID,
              amount: { amount: 12000, currency: "BRL" },
            },
          ],
        },
      ]);
    });
    expect(
      (await screen.findAllByText(label["transaction.categorize.done"])).length,
    ).toBeGreaterThan(0);
  });

  it("refetches on a categorize conflict and retries with the new version", async () => {
    const bodies: { expected_version: number }[] = [];
    let version = 3;
    const fetch = fakeApi({
      ...sharedRoutes,
      [`GET /api/v1/transactions/${txID}`]: () =>
        json(200, transactionFixture({ version })),
      [`POST /api/v1/transactions/${txID}/categorize`]: async (req) => {
        bodies.push((await req.json()) as { expected_version: number });
        if (bodies.length > 1) {
          return json(200, transactionFixture({ version: 5 }));
        }
        version = 4;
        return problem(409, "version_conflict");
      },
    });
    const user = userEvent.setup();
    await renderApp(`/transactions/${txID}`, { fetch });
    await user.click(
      await screen.findByRole("button", {
        name: label["transaction.actions.categorize"],
      }),
    );
    const dialog = within(await screen.findByRole("dialog"));
    await user.click(
      await dialog.findByRole("combobox", {
        name: label["transactions.new.splitCategory"].replace("{n}", "1"),
      }),
    );
    await user.click(await screen.findByRole("option", { name: "Lazer" }));
    const save = dialog.getByRole("button", {
      name: label["transaction.categorize.save"],
    });
    await user.click(save);
    expect(
      await dialog.findByText(
        label["transaction.categorize.conflict"].replace("{version}", "4"),
      ),
    ).toBeTruthy();
    await user.click(save);
    await waitFor(() => {
      expect(bodies.map((b) => b.expected_version)).toEqual([3, 4]);
    });
  });

  it("lists one timeline item per earlier version with its reason and date", async () => {
    const { fetch } = newApi();
    const user = userEvent.setup();
    await renderApp(`/transactions/${txID}`, { fetch });
    await user.click(
      await screen.findByRole("button", {
        name: label["transaction.actions.history"],
      }),
    );
    expect(await screen.findByText("typo in the amount")).toBeTruthy();
    expect(screen.getByText("first entry")).toBeTruthy();
    expect(
      screen.getByText(
        label["transaction.history.version"].replace("{n}", "2"),
      ),
    ).toBeTruthy();
    const times = Array.from(document.querySelectorAll("time"));
    expect(times.map((el) => el.getAttribute("datetime"))).toEqual([
      "2026-10-12T10:00:00Z",
      "2026-10-11T09:00:00Z",
    ]);
  });

  it("puts the actions in the title line as a menu on a phone and as buttons on a desktop", async () => {
    const user = userEvent.setup();
    const phone = await renderApp(`/transactions/${txID}`, {
      fetch: newApi().fetch,
      width: 360,
    });
    await user.click(
      await screen.findByRole("button", {
        name: label["transaction.actions.more"],
      }),
    );
    for (const key of [
      "transaction.actions.correct",
      "transaction.actions.categorize",
      "transaction.actions.void",
      "transaction.actions.history",
    ] as const) {
      expect(
        await screen.findByRole("menuitem", { name: label[key] }),
      ).toBeTruthy();
    }
    expect(
      screen.queryByRole("button", { name: label["transaction.actions.void"] }),
    ).toBeNull();
    phone.unmount();

    await renderApp(`/transactions/${txID}`, {
      fetch: newApi().fetch,
      width: 1280,
    });
    expect(
      await screen.findByRole("link", {
        name: label["transaction.actions.correct"],
      }),
    ).toBeTruthy();
    for (const key of [
      "transaction.actions.categorize",
      "transaction.actions.void",
      "transaction.actions.history",
    ] as const) {
      expect(
        await screen.findByRole("button", { name: label[key] }),
      ).toBeTruthy();
    }
    expect(
      screen.queryByRole("button", { name: label["transaction.actions.more"] }),
    ).toBeNull();
  });
});
