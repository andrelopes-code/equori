import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { components } from "@/api/schema.gen";
import { ProposalCard } from "@/features/assistant/proposal/proposal-card";
import { catalogEn } from "@/i18n/catalog.en";
import { fakeApi, json } from "@/testing/fake-api";
import { expectNoAmounts, hideAmounts } from "@/testing/privacy";
import { renderWithProviders, renderWithRouter } from "@/testing/render-app";
import { setViewport } from "@/testing/viewport";

type Proposal = components["schemas"]["AssistantProposal"];

const pending: Proposal = {
  id: "p1",
  tool: "record_transaction",
  status: "pending",
  suggested: false,
  waiting_for: [],
  preview: {
    action: "record_transaction",
    target: "Checking",
    changes: [
      {
        field: "amount",
        before: { amount: "10.00", currency: "BRL" },
        after: { amount: "1234.56", currency: "BRL" },
      },
      { field: "description", after: { text: "Lunch" } },
    ],
  },
  created_at: "2026-10-23T10:00:00Z",
  // P15 expires a card at this instant; the fixture stays pending.
  expires_at: "2099-10-23T10:15:00Z",
};

const leaks = ["1234.56", "1.234,56", "1,234.56"];

describe("ProposalCard", () => {
  it("shows the action, the target and each change", () => {
    renderWithProviders(<ProposalCard proposal={pending} />, {
      fetch: fakeApi({}),
    });
    expect(screen.getByText("Record transaction")).toBeInTheDocument();
    expect(screen.getByText("Checking")).toBeInTheDocument();
    expect(screen.getByText("Amount")).toBeInTheDocument();
    expect(screen.getByText("Lunch")).toBeInTheDocument();
    // The value it replaces is struck through, then the new one.
    const before = screen.getByText(/10[.,]00/);
    const after = screen.getByText(/1[.,]234[.,]56/);
    expect(before.textContent).toMatch(/^was /);
    expect(after.textContent).toMatch(/^becomes /);
    expect(screen.getByRole("button", { name: "Confirm" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reject" })).toBeInTheDocument();
  });

  it("confirms once and disables both buttons while pending", async () => {
    let calls = 0;
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    renderWithProviders(<ProposalCard proposal={pending} />, {
      fetch: fakeApi({
        "POST /api/v1/assistant/proposals/p1/confirm": async () => {
          calls += 1;
          await gate;
          return json(200, { ...pending, status: "executed" });
        },
      }),
    });
    const confirm = screen.getByRole("button", { name: "Confirm" });
    await userEvent.click(confirm);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Reject" })).toBeDisabled();
    });
    expect(confirm).toBeDisabled();
    await userEvent.click(confirm);
    release();
    expect(await screen.findByText("Done")).toBeInTheDocument();
    expect(calls).toBe(1);
    expect(screen.queryByRole("button", { name: "Confirm" })).toBeNull();
  });

  it("rejects a pending proposal", async () => {
    renderWithProviders(<ProposalCard proposal={pending} />, {
      fetch: fakeApi({
        "POST /api/v1/assistant/proposals/p1/reject": () =>
          json(200, { ...pending, status: "rejected" }),
      }),
    });
    await userEvent.click(screen.getByRole("button", { name: "Reject" }));
    expect(await screen.findByText("Rejected")).toBeInTheDocument();
  });

  it.each([
    ["executed", catalogEn["assistant.proposal.status.executed"]],
    ["stale", catalogEn["assistant.proposal.status.stale"]],
    ["expired", catalogEn["assistant.proposal.status.expired"]],
  ] as const)("renders %s as a label without buttons", (status, label) => {
    renderWithProviders(<ProposalCard proposal={{ ...pending, status }} />, {
      fetch: fakeApi({}),
    });
    expect(screen.getByText(label)).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("shows the detail of a failed execution", () => {
    renderWithProviders(
      <ProposalCard
        proposal={{
          ...pending,
          status: "failed",
          result: { detail: "the account is closed" },
        }}
      />,
      { fetch: fakeApi({}) },
    );
    expect(screen.getByText("the account is closed")).toBeInTheDocument();
  });

  it("writes no amount while privacy is on", () => {
    hideAmounts();
    const { container } = renderWithProviders(
      <ProposalCard proposal={pending} />,
      { fetch: fakeApi({}) },
    );
    expect(within(container).getByText("Amount")).toBeInTheDocument();
    expectNoAmounts(container, leaks);
  });

  // P15: a pending card shows its expiry and turns expired at that instant without a click.
  it("shows the expiry and turns expired without a click (P15)", () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    vi.setSystemTime(new Date("2026-10-23T10:00:00Z"));
    try {
      renderWithProviders(
        <ProposalCard
          proposal={{ ...pending, expires_at: "2026-10-23T10:05:00Z" }}
        />,
        { fetch: fakeApi({}) },
      );
      expect(screen.getByText(/^Expires at /)).toBeInTheDocument();
      act(() => {
        vi.advanceTimersByTime(5 * 60_000);
      });
      expect(
        screen.getByText(catalogEn["assistant.proposal.status.expired"]),
      ).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Confirm" })).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  // Review Focus 4 of phase 4: the server's answer to a confirm in flight wins over the timer.
  it("keeps the server's answer when the expiry passes during a confirm", async () => {
    vi.useFakeTimers({
      toFake: ["setTimeout", "clearTimeout", "Date"],
      shouldAdvanceTime: true,
    });
    vi.setSystemTime(new Date("2026-10-23T10:04:59Z"));
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    try {
      renderWithProviders(
        <ProposalCard
          proposal={{ ...pending, expires_at: "2026-10-23T10:05:00Z" }}
        />,
        {
          fetch: fakeApi({
            "POST /api/v1/assistant/proposals/p1/confirm": async () => {
              await gate;
              return json(200, { ...pending, status: "executed" });
            },
          }),
        },
      );
      await userEvent.click(screen.getByRole("button", { name: "Confirm" }));
      act(() => {
        vi.advanceTimersByTime(2_000);
      });
      expect(
        screen.queryByText(catalogEn["assistant.proposal.status.expired"]),
      ).toBeNull();
      release();
      expect(
        await screen.findByText(
          catalogEn["assistant.proposal.status.executed"],
        ),
      ).toBeInTheDocument();
      expect(
        screen.queryByText(catalogEn["assistant.proposal.status.expired"]),
      ).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  // P14 (amended 2026-10-30): each field is one row of the list, its name then its value.
  it("lays each field on a row of its own (P14)", () => {
    renderWithProviders(<ProposalCard proposal={pending} />, {
      fetch: fakeApi({}),
    });

    const rows = [...document.querySelectorAll("dl > div")];

    expect(
      rows.map((row) => [...row.children].map((cell) => cell.tagName)),
    ).toEqual(pending.preview.changes.map(() => ["DT", "DD"]));
    expect(rows[0]?.querySelector("dt")).toHaveTextContent("Amount");

    // The value a change writes reads first; the one it replaces follows it.
    const value = rows[0]?.querySelector("dd")?.textContent ?? "";

    const after = value.indexOf(catalogEn["assistant.change.after"]);
    const before = value.indexOf(catalogEn["assistant.change.before"]);

    expect(after).toBeGreaterThanOrEqual(0);
    expect(after).toBeLessThan(before);
  });

  // P16: an executed proposal whose result names a record links to its screen.
  it("opens the transaction an executed proposal recorded", () => {
    renderWithRouter(
      <ProposalCard
        proposal={{
          ...pending,
          status: "executed",
          result: { transaction_id: "t1" },
        }}
      />,
      { path: "/", fetch: fakeApi({}) },
    );
    expect(
      screen.getByRole("link", { name: catalogEn["assistant.proposal.open"] }),
    ).toHaveAttribute("href", "/transactions/t1");
  });

  // ADR 027, S6: the rules are desktop-only, so a phone shows no way to the rule.
  it("leaves out the screen of a desktop-only record on a phone", () => {
    setViewport(390);

    renderWithRouter(
      <ProposalCard
        proposal={{
          ...pending,
          tool: "manage_rule",
          status: "executed",
          result: { rule_id: "r1" },
        }}
      />,
      { path: "/", fetch: fakeApi({}) },
    );

    expect(
      screen.queryByRole("link", {
        name: catalogEn["assistant.proposal.open"],
      }),
    ).toBeNull();
  });

  it("labels a suggested card and gives its reason", () => {
    renderWithProviders(
      <ProposalCard
        proposal={{ ...pending, suggested: true, reason: "Repeats monthly" }}
      />,
      { fetch: fakeApi({}) },
    );
    expect(
      screen.getByText(catalogEn["assistant.proposal.suggested"]),
    ).toBeInTheDocument();
    expect(screen.getByText("Repeats monthly")).toBeInTheDocument();
  });

  it("shows no suggestion label on a requested card", () => {
    renderWithProviders(<ProposalCard proposal={pending} />, {
      fetch: fakeApi({}),
    });
    expect(
      screen.queryByText(catalogEn["assistant.proposal.suggested"]),
    ).toBeNull();
  });

  it("shows a waiting card with its summary, its parents and no buttons", () => {
    const parent = { ...pending, id: "p0" };
    const waiting: Proposal = {
      ...pending,
      id: "p2",
      status: "waiting",
      summary: "Create the subscription",
      waiting_for: ["p0", "p3"],
    };
    const other = {
      ...pending,
      id: "p3",
      preview: { ...pending.preview, action: "manage_schedule.create" },
    };
    renderWithProviders(
      <ProposalCard proposal={waiting} siblings={[parent, waiting, other]} />,
      { fetch: fakeApi({}) },
    );
    expect(screen.getByText("Create the subscription")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Waits for the confirmation of: Record transaction, Create schedule",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(catalogEn["assistant.proposal.status.waiting"]),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("shows a blocked card with its text and no buttons", () => {
    renderWithProviders(
      <ProposalCard proposal={{ ...pending, status: "blocked" }} />,
      { fetch: fakeApi({}) },
    );
    expect(
      screen.getByText(catalogEn["assistant.proposal.blocked"]),
    ).toBeInTheDocument();
    expect(
      screen.getByText(catalogEn["assistant.proposal.status.blocked"]),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
  });
});
