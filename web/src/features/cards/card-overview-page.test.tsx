import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { catalogPtBR } from "@/i18n/catalog.pt-BR";
import { writeLocale } from "@/i18n/locale";
import { addMonths } from "@/features/cards/reference-months";
import {
  cardAccount,
  cardID,
  cardRoutes,
  statement,
  statementID,
} from "@/testing/card-api";
import type { Statement } from "@/testing/card-api";
import { fakeApi, json } from "@/testing/fake-api";
import { renderApp } from "@/testing/render-app";

beforeEach(() => {
  localStorage.clear();
  writeLocale("pt-BR");
});

function only<T>(value: T | null | undefined): T {
  if (value === null || value === undefined) throw new Error("missing value");
  return value;
}

const base = `/api/v1/accounts/${cardID}`;
const money = (amount: number) => ({ amount, currency: "BRL" });
const groupName = (key: keyof typeof catalogPtBR) => ({
  name: catalogPtBR[key],
});

function statementsRoute(items: Statement[], urls: string[] = []) {
  return {
    [`GET ${base}/statements`]: (req: Request) => {
      urls.push(req.url);
      return json(200, { items });
    },
  };
}

async function renderCard(
  over: Parameters<typeof cardRoutes>[0] = {},
  width = 1280,
) {
  return renderApp(`/cards/${cardID}`, {
    width,
    fetch: fakeApi(cardRoutes(over)),
  });
}

describe("card overview", () => {
  it("requests the statements from twelve months back with the page limit", async () => {
    const urls: string[] = [];
    await renderCard(statementsRoute([statement("2026-11")], urls));
    await screen.findByRole("group", groupName("cards.current.title"));
    expect(urls.map((url) => new URL(url).search)).toEqual([
      "?from=2025-10&limit=200",
    ]);
  });

  it("shows the current statement with its dates, amount due and unpaid amount", async () => {
    await renderCard(
      statementsRoute([
        statement("2026-10", { status: "paid" }),
        statement("2026-11", {
          amount_due: money(123456),
          unpaid: money(100000),
        }),
        statement("2026-12"),
      ]),
    );
    const card = await screen.findByRole(
      "group",
      groupName("cards.current.title"),
    );
    const view = within(card);
    expect(view.getByText("nov. de 2026")).toBeInTheDocument();
    expect(
      view.getByText(catalogPtBR["cards.status.open"]),
    ).toBeInTheDocument();
    expect(view.getByText("03/11/2026")).toBeInTheDocument();
    expect(view.getByText("10/11/2026")).toBeInTheDocument();
    expect(view.getByText("R$ 1.234,56")).toBeInTheDocument();
    expect(view.getByText("R$ 1.000,00")).toBeInTheDocument();
  });

  it("lists the later statements as upcoming and the earlier ones as past, with the status tone", async () => {
    await renderCard(
      statementsRoute([
        statement("2026-08", { status: "overdue" }),
        statement("2026-09", { status: "paid" }),
        statement("2026-10", { status: "closed" }),
        statement("2026-11"),
        statement("2026-12"),
        statement("2027-01", { amount_due: money(7000) }),
      ]),
    );
    const upcoming = await screen.findByRole(
      "list",
      groupName("cards.group.upcoming"),
    );
    const upcomingRows = within(upcoming).getAllByRole("listitem");
    expect(upcomingRows).toHaveLength(2);
    expect(upcomingRows[0]).toHaveTextContent("dez. de 2026");
    expect(upcomingRows[1]).toHaveTextContent("jan. de 2027");
    expect(upcomingRows[1]).toHaveTextContent("10/01/2027");
    expect(upcomingRows[1]).toHaveTextContent("R$ 70,00");
    const past = screen.getByRole("list", groupName("cards.group.past"));
    const pastRows = within(past).getAllByRole("listitem");
    expect(pastRows.map((row) => row.textContent)).toEqual([
      expect.stringContaining("out. de 2026"),
      expect.stringContaining("set. de 2026"),
      expect.stringContaining("ago. de 2026"),
    ]);
    const tones = pastRows.map((row) =>
      row.querySelector('[data-ui="tag"]')?.getAttribute("data-tone"),
    );
    expect(tones).toEqual(["accent", "success", "danger"]);
    expect(within(only(pastRows[0])).getByRole("link")).toHaveAttribute(
      "href",
      `/cards/${cardID}/statements/${statementID("2026-10")}`,
    );
  });

  it("shows the debt, the limits and the used share", async () => {
    const { container } = await renderCard();
    await screen.findByRole("group", groupName("cards.current.title"));
    await waitFor(() => {
      const stats = [...container.querySelectorAll('[data-ui="stat-card"]')];
      expect(stats).toHaveLength(3);
      expect(stats[0]).toHaveTextContent(
        `${catalogPtBR["cards.stat.debt"]}R$ 1.000,00`,
      );
      expect(stats[1]).toHaveTextContent(
        `${catalogPtBR["cards.stat.limit"]}R$ 5.000,00`,
      );
      expect(stats[2]).toHaveTextContent(
        `${catalogPtBR["cards.stat.available"]}R$ 4.000,00`,
      );
    });
    expect(screen.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "20",
    );
  });

  it("renders no limit without a credit limit", async () => {
    await renderCard({
      [`GET ${base}`]: () => json(200, { ...cardAccount, card: {} }),
    });
    const link = await screen.findByRole("link", {
      name: catalogPtBR["cards.stat.nolimit"],
    });
    expect(link).toHaveAttribute("href", `/cards/${cardID}/settings`);
    expect(screen.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "0",
    );
  });

  it("moves the window back twelve months for the earlier statements", async () => {
    const urls: string[] = [];
    const { router } = await renderCard(
      statementsRoute([statement("2026-11")], urls),
    );
    await userEvent.setup().click(
      await screen.findByRole("link", {
        name: catalogPtBR["cards.action.earlier"],
      }),
    );
    await waitFor(() => {
      expect(router.state.location.search).toEqual({ from: "2024-10" });
    });
    await waitFor(() => {
      expect(urls.map((url) => new URL(url).search)).toEqual([
        "?from=2025-10&limit=200",
        "?from=2024-10&limit=200",
      ]);
    });
  });

  it("reads every statement page", async () => {
    const urls: string[] = [];
    const first = Array.from({ length: 12 }, (_, n) =>
      statement(addMonths("2025-10", n), { status: "paid" }),
    );
    await renderCard({
      [`GET ${base}/statements`]: (req) => {
        urls.push(req.url);
        const cursor = new URL(req.url).searchParams.get("cursor");
        return cursor === "c2"
          ? json(200, { items: [statement("2026-10")] })
          : json(200, { items: first, next_cursor: "c2" });
      },
    });
    const card = await screen.findByRole(
      "group",
      groupName("cards.current.title"),
    );
    expect(within(card).getByText("out. de 2026")).toBeInTheDocument();
    expect(urls.map((url) => new URL(url).searchParams.get("cursor"))).toEqual([
      null,
      "c2",
    ]);
  });

  it("omits the current statement card without an open statement and lists every statement as past", async () => {
    await renderCard(
      statementsRoute([
        statement("2026-09", { status: "paid" }),
        statement("2026-10", { status: "closed" }),
      ]),
    );
    const past = await screen.findByRole("list", groupName("cards.group.past"));
    expect(within(past).getAllByRole("listitem")).toHaveLength(2);
    expect(
      screen.queryByRole("group", groupName("cards.current.title")),
    ).toBeNull();
    expect(
      screen.queryByRole("list", groupName("cards.group.upcoming")),
    ).toBeNull();
  });

  it("links the new purchase and the enabled installment purchase", async () => {
    await renderCard();
    expect(
      await screen.findByRole("link", {
        name: catalogPtBR["cards.action.purchase"],
      }),
    ).toHaveAttribute("href", `/transactions/new?account_id=${cardID}`);
    expect(
      screen.getByRole("link", {
        name: catalogPtBR["cards.action.installment"],
      }),
    ).toHaveAttribute("href", `/cards/${cardID}/purchases/new`);
    expect(screen.queryByText(catalogPtBR["cards.rule.missing"])).toBeNull();
  });

  it("explains the missing billing rule and disables the installment purchase (C17)", async () => {
    await renderCard({
      [`GET ${base}/billing-cycle-rules`]: () => json(200, { items: [] }),
    });
    const message = await screen.findByText(catalogPtBR["cards.rule.missing"]);
    expect(
      within(
        only(message.closest<HTMLElement>('[data-ui="inline-message"]')),
      ).getByRole("link", {
        name: catalogPtBR["cards.rule.link"],
      }),
    ).toHaveAttribute("href", `/cards/${cardID}/settings`);
    expect(
      screen.getByRole("button", {
        name: catalogPtBR["cards.action.installment"],
      }),
    ).toBeDisabled();
    expect(
      screen.queryByRole("link", {
        name: catalogPtBR["cards.action.installment"],
      }),
    ).toBeNull();
  });

  it("pays the current statement while it has an unpaid amount", async () => {
    await renderCard();
    expect(
      await screen.findByRole("link", {
        name: catalogPtBR["cards.action.pay"],
      }),
    ).toHaveAttribute(
      "href",
      `/cards/${cardID}/statements/${statementID("2026-11")}/pay`,
    );
  });

  it("pays an overdue statement before the current one", async () => {
    await renderCard(
      statementsRoute([
        statement("2026-09", { status: "overdue" }),
        statement("2026-11"),
      ]),
    );
    expect(
      await screen.findByRole("link", {
        name: catalogPtBR["cards.action.pay"],
      }),
    ).toHaveAttribute(
      "href",
      `/cards/${cardID}/statements/${statementID("2026-09")}/pay`,
    );
  });

  it("offers no payment when the current statement has nothing unpaid", async () => {
    await renderCard(
      statementsRoute([statement("2026-11", { unpaid: money(0) })]),
    );
    await screen.findByRole("group", groupName("cards.current.title"));
    expect(
      screen.queryByRole("link", { name: catalogPtBR["cards.action.pay"] }),
    ).toBeNull();
  });
});

describe("card overview layout", () => {
  async function order(width: number) {
    const { container } = await renderCard({}, width);
    const card = await screen.findByRole(
      "group",
      groupName("cards.current.title"),
    );
    await waitFor(() => {
      expect(container.querySelectorAll('[data-ui="stat-card"]')).toHaveLength(
        3,
      );
    });
    const stats = [...container.querySelectorAll('[data-ui="stat-card"]')];
    return { card, stats };
  }

  const following = (from: Node, to: Node) =>
    (from.compareDocumentPosition(to) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;

  it("places the current statement before the stat-cards in one row at 360 px", async () => {
    const { card, stats } = await order(360);
    expect(following(card, only(stats[0]))).toBe(true);
    expect(new Set(stats.map((stat) => stat.parentElement)).size).toBe(1);
  });

  it.each([768, 1280])(
    "places the stat-cards before the current statement at %i px",
    async (width) => {
      const { card, stats } = await order(width);
      expect(following(only(stats[2]), card)).toBe(true);
      expect(new Set(stats.map((stat) => stat.parentElement)).size).toBe(1);
    },
  );
});
