import type { components } from "@/api/schema.gen";

type Proposal = components["schemas"]["AssistantProposal"];
type Preview = components["schemas"]["AssistantPreview"];
type Value = components["schemas"]["AssistantValue"];

const minute = 60_000;

// Built once per page load so the deadline ring reads 15 minutes and an expired card reads past.
const now = Date.now();

export function brl(amount: string): Value {
  return { amount, currency: "BRL" };
}

export function text(value: string): Value {
  return { text: value };
}

export function day(date: string): Value {
  return { date };
}

// A proposal of the preview: pending, 15 minutes to decide, unless extra says otherwise.
export function proposal(
  id: string,
  tool: string,
  preview: Preview,
  extra: Partial<Proposal> = {},
): Proposal {
  return {
    id,
    tool,
    status: "pending",
    suggested: false,
    waiting_for: [],
    preview,
    created_at: new Date(now - minute).toISOString(),
    expires_at: new Date(now + 15 * minute).toISOString(),
    ...extra,
  };
}

export function expired(): Partial<Proposal> {
  return { expires_at: new Date(now - 5 * minute).toISOString() };
}
