import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { AnswerView } from "@/features/assistant/view/answer-view";
import type { AssistantView } from "@/features/assistant/view/view-types";
import { fakeApi } from "@/testing/fake-api";
import { renderWithRouter } from "@/testing/render-app";

const brl = (amount: number) => ({ amount, currency: "BRL" });

function view(form: string, data: Record<string, unknown>): AssistantView {
  return {
    id: form,
    form,
    payload: {
      title: { key: "assistantView.ranking.title" },
      window: { from: "2026-10-01", to: "2026-10-31" },
      verdict: { key: "assistantView.ranking.empty" },
      next: [],
      rows: { head: [], rows: [] },
      data,
    },
  };
}

describe("view bodies", () => {
  it("links each ranking row to its transactions and names the rest", async () => {
    renderWithRouter(
      <AnswerView
        view={view("ranking", {
          total: brl(819105),
          items: [
            {
              account_id: "a1",
              name: "Moradia",
              amount: brl(320000),
              share_bp: 3907,
              rank: 1,
            },
          ],
          rest: { count: 7, amount: brl(192760), share_bp: 2353 },
        })}
      />,
      { path: "/", fetch: fakeApi({}) },
    );

    expect(screen.getByRole("link", { name: /Moradia/ })).toHaveAttribute(
      "href",
      "/transactions?account_id=a1&from=2026-10-01&to=2026-10-31",
    );
    expect(screen.getByText("Other 7 categories")).toBeInTheDocument();
    expect(screen.getByText("39%", { selector: "small" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("radio", { name: "Share" }));

    expect(screen.queryByText("39%", { selector: "small" })).toBeNull();
  });

  it("names both periods of a comparison", () => {
    renderWithRouter(
      <AnswerView
        view={view("compare", {
          periods: [
            { from: "2026-09-01", to: "2026-09-30" },
            { from: "2026-10-01", to: "2026-10-31" },
          ],
          items: [
            {
              account_id: "a1",
              name: "Mercado",
              before: brl(118460),
              after: brl(149700),
            },
          ],
          difference: brl(31240),
        })}
      />,
      { path: "/", fetch: fakeApi({}) },
    );

    expect(screen.getByText("September 2026")).toBeInTheDocument();
    // October names the view's period in the head and the later period in the legend.
    expect(screen.getAllByText("October 2026")).toHaveLength(2);
    expect(screen.getByText("Mercado")).toBeInTheDocument();
  });
});
