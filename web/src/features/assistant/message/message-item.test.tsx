import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { components } from "@/api/schema.gen";
import { assistantKeys } from "@/features/assistant/api";
import { MessageItem } from "@/features/assistant/message/message-item";
import { fakeApi, json } from "@/testing/fake-api";
import { renderWithProviders } from "@/testing/render-app";

type Proposal = components["schemas"]["AssistantProposal"];

const base: Proposal = {
  id: "p1",
  tool: "record_transaction",
  status: "pending",
  suggested: false,
  waiting_for: [],
  preview: { action: "record_transaction", changes: [] },
  created_at: "2026-10-23T10:00:00Z",
  expires_at: "2099-10-23T10:15:00Z",
};

function renderItem(proposals: Proposal[], fetch: typeof globalThis.fetch) {
  const client = new QueryClient();
  const invalidate = vi.spyOn(client, "invalidateQueries");

  renderWithProviders(
    <QueryClientProvider client={client}>
      <MessageItem
        conversationId="c1"
        message={{
          id: "m2",
          role: "assistant",
          content: "Changes.",
          outcome: "answered",
          created_at: "2026-10-23T10:00:01Z",
          proposals,
          files: [],
          views: [],
        }}
      />
    </QueryClientProvider>,
    { fetch },
  );

  return invalidate;
}

describe("MessageItem proposals", () => {
  // Spec 2026-11-15 section 4 (Dependent): the sheet's confirm follows a marked parent with its
  // dependents.
  it("confirms pending and waiting proposals in order", async () => {
    const order: string[] = [];
    const answer = (id: string) => () => {
      order.push(id);
      return json(200, { ...base, id, status: "executed" });
    };
    renderItem(
      [
        base,
        { ...base, id: "p2", status: "waiting", waiting_for: ["p1"] },
        { ...base, id: "p3", status: "blocked" },
      ],
      fakeApi({
        "POST /api/v1/assistant/proposals/p1/confirm": answer("p1"),
        "POST /api/v1/assistant/proposals/p2/confirm": answer("p2"),
        "POST /api/v1/assistant/proposals/p3/confirm": answer("p3"),
      }),
    );

    await userEvent.click(screen.getByRole("button", { name: "Confirm 1" }));

    await waitFor(() => {
      expect(order).toEqual(["p1", "p2"]);
    });
  });

  // Spec 2026-11-15 section 5 (All decided).
  it("replaces the sheet with the receipt once its only proposal is confirmed", async () => {
    renderItem(
      [base],
      fakeApi({
        "POST /api/v1/assistant/proposals/p1/confirm": () =>
          json(200, { ...base, status: "executed" }),
      }),
    );

    await userEvent.click(screen.getByRole("button", { name: "Confirm 1" }));

    expect(await screen.findByText("Transaction recorded")).toBeInTheDocument();
    expect(screen.queryByText("1 change to review")).not.toBeInTheDocument();
  });

  it("invalidates the conversation after a confirm", async () => {
    const invalidate = renderItem(
      [base],
      fakeApi({
        "POST /api/v1/assistant/proposals/p1/confirm": () =>
          json(200, { ...base, status: "executed" }),
      }),
    );

    await userEvent.click(screen.getByRole("button", { name: "Confirm 1" }));

    await waitFor(() => {
      expect(invalidate).toHaveBeenCalledWith({
        queryKey: assistantKeys.conversation("c1"),
      });
    });
  });

  it("invalidates the conversation after a reject", async () => {
    const invalidate = renderItem(
      [base],
      fakeApi({
        "POST /api/v1/assistant/proposals/p1/reject": () =>
          json(200, { ...base, status: "rejected" }),
      }),
    );

    await userEvent.click(screen.getByRole("button", { name: "Reject" }));

    await waitFor(() => {
      expect(invalidate).toHaveBeenCalledWith({
        queryKey: assistantKeys.conversation("c1"),
      });
    });
  });
});
