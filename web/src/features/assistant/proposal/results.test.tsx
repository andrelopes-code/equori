import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { components } from "@/api/schema.gen";
import { DecisionSheet } from "@/features/assistant/proposal/decision-sheet";
import { Receipt } from "@/features/assistant/proposal/receipt";
import { ResultBlock } from "@/features/assistant/proposal/result-block";
import { catalogEn } from "@/i18n/catalog.en";
import { fakeApi } from "@/testing/fake-api";
import { expectNoAmounts, hideAmounts } from "@/testing/privacy";
import { renderWithRouter } from "@/testing/render-app";
import { setViewport } from "@/testing/viewport";

type Proposal = components["schemas"]["AssistantProposal"];

const routed = { path: "/", fetch: fakeApi({}) };

const recorded: Proposal = {
  id: "p1",
  tool: "record_transaction",
  status: "executed",
  suggested: false,
  waiting_for: [],
  preview: {
    action: "record_transaction",
    target: "Checking",
    changes: [
      { field: "amount", after: { amount: "-42.90", currency: "BRL" } },
      { field: "description", after: { text: "Lunch" } },
      { field: "account", after: { text: "Checking" } },
      { field: "date", after: { date: "2026-11-15" } },
    ],
  },
  result: { transaction_id: "t1" },
  created_at: "2026-10-23T10:00:00Z",
  expires_at: "2099-10-23T10:15:00Z",
  decided_at: "2026-10-23T10:05:00Z",
};

const rule: Proposal = {
  ...recorded,
  id: "p2",
  tool: "manage_rule",
  preview: {
    action: "manage_rule.create_rule",
    target: "Market",
    changes: [{ field: "category", after: { text: "Groceries" } }],
  },
  result: { rule_id: "r1" },
};

// Spec 2026-11-15 section 5: a result replaces its proposal.
describe("Receipt", () => {
  // Spec 2026-11-15 section 5 (Receipt).
  it("draws a receipt for a recorded transaction", () => {
    renderWithRouter(<Receipt proposal={recorded} />, routed);

    expect(
      screen.getByText(catalogEn["assistant.result.receipt"]),
    ).toBeInTheDocument();
    expect(screen.getByText("Lunch")).toBeInTheDocument();
    expect(screen.getByText("Checking")).toBeInTheDocument();
    expect(screen.getByText(/42[.,]90/)).toBeInTheDocument();
    expect(screen.getByText("Description")).toBeInTheDocument();
    expect(screen.getByText("Account")).toBeInTheDocument();
    expect(screen.getByText("Date")).toBeInTheDocument();
  });

  it("leaves out the time line without a decision time", () => {
    const { decided_at, ...undecided } = recorded;

    expect(decided_at).toBeDefined();

    renderWithRouter(<Receipt proposal={undecided} />, routed);

    expect(
      screen.getByText(catalogEn["assistant.result.receipt"]),
    ).toBeInTheDocument();
    expect(document.querySelector("time")).toBeNull();
  });

  // P16: an executed proposal whose result names a record links to its screen.
  it("opens the transaction an executed proposal recorded", () => {
    renderWithRouter(<Receipt proposal={recorded} />, routed);

    expect(
      screen.getByRole("link", { name: catalogEn["assistant.proposal.open"] }),
    ).toHaveAttribute("href", "/transactions/t1");
  });

  it("writes no amount while privacy is on", () => {
    hideAmounts();

    const { container } = renderWithRouter(
      <Receipt proposal={recorded} />,
      routed,
    );

    expectNoAmounts(container, ["42.90", "42,90"]);
  });
});

describe("ResultBlock", () => {
  // Spec 2026-11-15 section 5 (Failed): the server's detail after the not-applied text, no icon.
  it("shows the detail of a failed execution", () => {
    renderWithRouter(
      <ResultBlock
        proposal={{
          ...rule,
          status: "failed",
          result: { detail: "the account is closed" },
        }}
      />,
      routed,
    );

    const detail = screen.getByText(
      `${catalogEn["assistant.result.not_applied"]} the account is closed`,
    );

    expect(detail.querySelector("svg")).toBeNull();
    expect(within(detail).queryByRole("img")).toBeNull();
  });

  // ADR 027, S6: the rules are desktop-only, so a phone shows no way to the rule.
  it("leaves out the screen of a desktop-only record on a phone", () => {
    setViewport(390);

    renderWithRouter(<ResultBlock proposal={rule} />, routed);

    expect(
      screen.queryByRole("link", {
        name: catalogEn["assistant.proposal.open"],
      }),
    ).toBeNull();
  });

  it("shows a blocked result with its text", () => {
    renderWithRouter(
      <ResultBlock proposal={{ ...rule, status: "blocked" }} />,
      routed,
    );

    expect(
      screen.getByText(catalogEn["assistant.proposal.blocked"]),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it.each([
    "executed",
    "failed",
    "rejected",
    "stale",
    "discarded",
    "blocked",
  ] as const)("labels the state %s with a word", (status) => {
    renderWithRouter(<ResultBlock proposal={{ ...rule, status }} />, routed);

    expect(
      screen.getByText(catalogEn[`assistant.proposal.status.${status}`]),
    ).toBeInTheDocument();
  });

  // P15: a pending proposal past its expiry instant is an expired result.
  it("shows the expiry hint (P15)", () => {
    renderWithRouter(
      <ResultBlock
        proposal={{
          ...rule,
          status: "pending",
          expires_at: "2020-10-23T10:15:00Z",
        }}
      />,
      routed,
    );

    expect(
      screen.getByText(catalogEn["assistant.proposal.status.expired"]),
    ).toBeInTheDocument();
    expect(
      screen.getByText(catalogEn["assistant.proposal.hint.expired"]),
    ).toBeInTheDocument();
  });

  // P14 (amended 2026-10-30): each field is one row of the list, its name then its value.
  it("lays each field on a row of its own (P14)", () => {
    const fields: Proposal = {
      ...recorded,
      preview: { ...recorded.preview, action: "manage_card.add_card" },
    };

    renderWithRouter(<ResultBlock proposal={fields} />, routed);

    const rows = [...document.querySelectorAll("dl > div")];

    expect(
      rows.map((row) => [...row.children].map((cell) => cell.tagName)),
    ).toEqual(fields.preview.changes.map(() => ["DT", "DD"]));
  });
});

describe("DecisionSheet rows", () => {
  it("labels a decided row with its state and folds its body", () => {
    renderWithRouter(
      <DecisionSheet
        rows={[{ proposal: { ...rule, status: "failed" }, dependents: [] }]}
        deadline={undefined}
        now={0}
        siblings={[rule]}
        reveal={false}
        onDecided={() => undefined}
      />,
      routed,
    );

    expect(
      screen.getByText(catalogEn["assistant.proposal.status.failed"]),
    ).toBeInTheDocument();
    expect(screen.queryByText("Groceries")).toBeNull();
    expect(screen.queryByRole("button", { name: /^Confirm/ })).toBeNull();
  });
});
