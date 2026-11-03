import { describe, expect, it } from "vitest";

import type { components } from "@/api/schema.gen";
import {
  actionTitle,
  proposalCardState,
} from "@/features/assistant/proposal-card-state";
import { catalogEn } from "@/i18n/catalog.en";
import type { MessageKey } from "@/i18n/catalog.en";

type Proposal = components["schemas"]["AssistantProposal"];

const t = (key: MessageKey) => catalogEn[key];

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

const input = { shown: base, passed: false, busy: false, error: null, t };

describe("proposalCardState", () => {
  it("turns an idle pending proposal expired once its time passed", () => {
    const state = proposalCardState({ ...input, passed: true });

    expect(state.status).toBe("expired");
    expect(state.hint).toBe(true);
    expect(state.outcome).toBe(catalogEn["assistant.proposal.hint.expired"]);
  });

  it("keeps pending while a decision is in flight", () => {
    const state = proposalCardState({ ...input, passed: true, busy: true });

    expect(state.status).toBe("pending");
    expect(state.outcome).toBeUndefined();
  });

  it("reads the detail of a failed result", () => {
    const shown = {
      ...base,
      status: "failed" as const,
      result: { detail: "closed" },
    };

    expect(proposalCardState({ ...input, shown }).outcome).toBe("closed");
  });

  it("ignores a failed result without a detail", () => {
    const shown = { ...base, status: "failed" as const, result: 3 };

    expect(proposalCardState({ ...input, shown }).outcome).toBeUndefined();
  });

  it("names the screen of an executed record", () => {
    const shown = {
      ...base,
      status: "executed" as const,
      result: { transaction_id: "t1" },
    };

    expect(proposalCardState({ ...input, shown }).screen).toBe(
      "/transactions/t1",
    );
  });

  it("says the transport failure of a decision", () => {
    const state = proposalCardState({ ...input, error: new Error("x") });

    expect(state.failure).toBe(catalogEn["problem.transport"]);
    expect(state.outcome).toBe(state.failure);
  });
});

describe("actionTitle", () => {
  it("returns the catalog text of a known action", () => {
    expect(actionTitle("record_transaction", t)).toBe("Record transaction");
  });

  it("returns an unknown action as it is", () => {
    expect(actionTitle("mystery", t)).toBe("mystery");
  });
});
