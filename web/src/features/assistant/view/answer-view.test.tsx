import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AnswerView } from "@/features/assistant/view/answer-view";
import { AskContext } from "@/features/assistant/view/ask-context";
import { FORMS } from "@/features/assistant/view/view-forms";
import type { FormBodyProps } from "@/features/assistant/view/view-forms";
import type { AssistantView } from "@/features/assistant/view/view-types";
import { fakeApi } from "@/testing/fake-api";
import { renderWithProviders } from "@/testing/render-app";

const view: AssistantView = {
  id: "v1",
  form: "ranking_test",
  payload: {
    title: { key: "assistantView.ranking.title" },
    window: { from: "2026-10-01", to: "2026-10-31" },
    verdict: {
      key: "assistantView.ranking.verdict",
      params: {
        name: { text: "Moradia" },
        share: { bp: 3907 },
        total: { money: { amount: 819105, currency: "BRL" } },
      },
    },
    prov: {
      key: "assistantView.prov.categories",
      params: { count: { count: 12 } },
    },
    next: ["Compare with September"],
    rows: {
      head: ["assistantView.col.category", "assistantView.col.total"],
      rows: [[{ text: "Moradia" }, { bp: 3907 }]],
    },
    data: {},
  },
};

function ShareBody({ unit }: FormBodyProps) {
  return <p>body in {unit}</p>;
}

function renderView(ask?: (text: string) => void) {
  renderWithProviders(
    <AskContext value={ask}>
      <AnswerView view={view} />
    </AskContext>,
    { fetch: fakeApi({}) },
  );
}

afterEach(() => {
  delete FORMS.ranking_test;
});

describe("AnswerView", () => {
  it("draws the anatomy and a table for a form the client lacks", () => {
    renderView();

    expect(
      screen.getByRole("region", { name: "Where the money went" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Moradia", { selector: "strong" }),
    ).toBeInTheDocument();
    expect(screen.getByText("39%", { selector: "strong" })).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: "Category" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("12 categories with postings in the period"),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("radiogroup", { name: "Form of the view" }),
    ).toBeNull();
  });

  it("switches a known form between its chart and its table, and amounts and shares", async () => {
    FORMS.ranking_test = { icon: "pie", unit: true, Body: ShareBody };
    renderView();

    expect(screen.getByText("body in amount")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("radio", { name: "Share" }));
    expect(screen.getByText("body in share")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("radio", { name: "Table" }));
    expect(screen.queryByText("body in share")).toBeNull();
    expect(screen.getByRole("table")).toBeInTheDocument();
  });

  // V25: a plot draws the rows as a chart in place of the form's body, without the unit toggle.
  it("draws the rows of a plot as a chart and switches to the table", async () => {
    FORMS.ranking_test = { icon: "pie", unit: true, Body: ShareBody };
    renderWithProviders(
      <AnswerView
        view={{
          ...view,
          payload: {
            ...view.payload,
            plot: {
              label: 0,
              series: [{ column: 1, kind: "pie" }],
              marks: [],
            },
          },
        }}
      />,
      { fetch: fakeApi({}) },
    );

    expect(screen.queryByText("body in amount")).toBeNull();
    expect(screen.queryByRole("radio", { name: "Share" })).toBeNull();
    expect(document.querySelector('[data-ui="chart"]')).toBeInTheDocument();

    await userEvent.click(screen.getByRole("radio", { name: "Table" }));
    expect(document.querySelector('[data-ui="chart"]')).toBeNull();
    expect(screen.getByRole("table")).toBeInTheDocument();
  });

  it("sends a follow-up question as the next message", async () => {
    const ask = vi.fn();
    renderView(ask);

    await userEvent.click(
      screen.getByRole("button", { name: "Compare with September" }),
    );

    expect(ask).toHaveBeenCalledWith("Compare with September");
  });

  it("disables follow-up questions where no conversation runs", () => {
    renderView();

    expect(
      screen.getByRole("button", { name: "Compare with September" }),
    ).toBeDisabled();
  });

  it("copies the view as text", async () => {
    const user = userEvent.setup();
    const write = vi.spyOn(navigator.clipboard, "writeText");
    renderView();

    await user.click(screen.getByRole("button", { name: "Copy as text" }));

    expect(write).toHaveBeenCalledWith(
      expect.stringContaining("Moradia takes 39% of the"),
    );
    expect(write).toHaveBeenCalledWith(
      expect.stringContaining("Category\tTotal\nMoradia\t39%"),
    );
  });
});
