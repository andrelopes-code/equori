import { describe, expect, it } from "vitest";

import { withHandled } from "@/features/assistant/preview/scenario-handled";
import type { Scenario } from "@/features/assistant/preview/scenario";

const scenario = (action: string): Scenario => ({
  id: action,
  form: action,
  note: action,
  handled: false,
  question: "q",
  answer: "a",
  proposals: [
    {
      id: "p",
      tool: action,
      status: "pending",
      suggested: false,
      waiting_for: [],
      preview: { action, changes: [] },
      created_at: "2026-11-19T10:00:00Z",
      expires_at: "2099-11-19T10:15:00Z",
    },
  ],
});

describe("withHandled", () => {
  it("marks a scenario whose action has a body", () => {
    expect(withHandled([scenario("transfer_custody")])[0]?.handled).toBe(true);
  });

  it("leaves a scenario whose action draws the change rows", () => {
    expect(withHandled([scenario("change_transaction")])[0]?.handled).toBe(
      false,
    );
  });
});
