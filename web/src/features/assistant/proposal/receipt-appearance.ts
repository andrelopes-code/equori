import type { components } from "@/api/schema.gen";

type Proposal = components["schemas"]["AssistantProposal"];

// The appearance choices an executed set_appearance wrote, under the names the web stores them;
// null for any other proposal (assistant parity design, AP3).
export function receiptAppearance(
  proposal: Proposal,
): Record<string, unknown> | null {
  if (proposal.tool !== "set_appearance" || proposal.status !== "executed") {
    return null;
  }

  const { result } = proposal;
  if (typeof result !== "object" || result === null) return null;

  return result as Record<string, unknown>;
}
