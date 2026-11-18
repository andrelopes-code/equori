import { describe, expect, it } from "vitest";

import type { components } from "@/api/schema.gen";
import { receiptAppearance } from "@/features/assistant/proposal/receipt-appearance";

type Proposal = components["schemas"]["AssistantProposal"];

function proposal(fields: Partial<Proposal>): Proposal {
  return { tool: "set_appearance", status: "executed", ...fields } as Proposal;
}

describe("receiptAppearance", () => {
  it("returns the choices an executed set_appearance wrote", () => {
    const result = { scheme: "light", textSize: "110" };

    expect(receiptAppearance(proposal({ result }))).toEqual(result);
  });

  it.each([
    ["a pending proposal", { status: "pending", result: { scheme: "light" } }],
    ["another tool", { tool: "update_profile", result: { language: "en" } }],
    ["a result that is not an object", { result: "light" }],
  ] as const)("returns null for %s", (_, fields) => {
    expect(receiptAppearance(proposal(fields as Partial<Proposal>))).toBeNull();
  });
});
