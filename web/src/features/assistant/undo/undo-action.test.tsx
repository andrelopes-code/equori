import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import type { components } from "@/api/schema.gen";
import { MessageItem } from "@/features/assistant/message/message-item";
import { fakeApi, json, problem } from "@/testing/fake-api";
import { renderWithRouter } from "@/testing/render-app";

type Proposal = components["schemas"]["AssistantProposal"];

const executed: Proposal = {
  id: "p1",
  tool: "manage_budget_or_goal",
  status: "executed",
  suggested: false,
  waiting_for: [],
  undoable: true,
  preview: {
    action: "manage_budget_or_goal.create_budget",
    target: "Restaurants",
    changes: [
      { field: "amount", after: { amount: "700.00", currency: "BRL" } },
    ],
  },
  result: { budget_id: "b1" },
  created_at: "2026-11-20T10:00:00Z",
  expires_at: "2026-11-20T10:15:00Z",
  decided_at: "2026-11-20T10:01:00Z",
};

const undone: Proposal = {
  ...executed,
  id: "u1",
  tool: "manage_budget_or_goal",
  undoable: false,
  undoes: "p1",
  preview: { action: "manage_budget_or_goal.delete_budget", changes: [] },
  result: { budget_id: "b1", deleted: true },
};

const undoPath = "POST /api/v1/assistant/proposals/p1/undo";

// Answer views design V19: Desfazer runs the inverse once and reads Desfeita after it.
describe("UndoAction", () => {
  it("runs the undo with the reason in the member's language and reads Undone", async () => {
    const bodies: unknown[] = [];

    renderAnswer(
      [executed],
      fakeApi({
        [undoPath]: async (req) => {
          bodies.push((await req.json()) as unknown);
          return json(200, { ...undone, status: "executed" });
        },
      }),
    );

    await userEvent.click(screen.getByRole("button", { name: "Undo" }));

    await waitFor(() => {
      expect(screen.getByText("Undone")).toBeInTheDocument();
    });
    expect(bodies).toEqual([{ reason: "Undone in the assistant" }]);
    expect(screen.queryByRole("button", { name: "Undo" })).toBeNull();
  });

  it("keeps Undo after a failed inverse and says why", async () => {
    renderAnswer(
      [executed],
      fakeApi({
        [undoPath]: () =>
          json(200, {
            ...undone,
            status: "failed",
            result: {
              code: "invalid_arguments",
              detail: "the budget has spending",
            },
          }),
      }),
    );

    await userEvent.click(screen.getByRole("button", { name: "Undo" }));

    expect(await screen.findByRole("status")).toHaveTextContent(
      /^Not undone\./,
    );
    expect(screen.getByRole("button", { name: "Undo" })).toBeInTheDocument();
  });

  it("states a refused undo", async () => {
    renderAnswer(
      [executed],
      fakeApi({ [undoPath]: () => problem(409, "proposal_undone") }),
    );

    await userEvent.click(screen.getByRole("button", { name: "Undo" }));

    expect(await screen.findByRole("status")).toHaveTextContent(
      /^Not undone\./,
    );
  });

  it("draws Undone for a reversed proposal and no card for its undo", () => {
    renderAnswer(
      [
        { ...executed, undoable: false, undone_by: "u1" },
        { ...undone, status: "executed" },
      ],
      fakeApi({}),
    );

    expect(screen.getByText("Undone")).toBeInTheDocument();
    expect(screen.queryByText("Done")).toBeNull();
    // The message and the one card of the reversed proposal.
    expect(screen.getAllByRole("article")).toHaveLength(2);
    expect(screen.queryByRole("button", { name: "Undo" })).toBeNull();
  });

  it("offers no Undo for a write without an inverse", () => {
    renderAnswer([{ ...executed, undoable: false }], fakeApi({}));

    expect(screen.queryByRole("button", { name: "Undo" })).toBeNull();
    expect(screen.queryByText("Undone")).toBeNull();
  });
});

function renderAnswer(proposals: Proposal[], fetch: typeof globalThis.fetch) {
  return renderWithRouter(
    <MessageItem
      message={{
        id: "m2",
        role: "assistant",
        content: "Budget created.",
        outcome: "answered",
        created_at: "2026-11-20T10:00:01Z",
        proposals,
        files: [],
        views: [],
      }}
    />,
    { path: "/", fetch },
  );
}
