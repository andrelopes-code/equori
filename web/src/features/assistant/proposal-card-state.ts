import { errorText } from "@/api/problem";
import type { components } from "@/api/schema.gen";
import { catalogKey } from "@/features/assistant/catalog-key";
import { proposalScreen } from "@/features/assistant/proposal-screen";
import type { TFunction } from "@/i18n/i18n-provider";

type Proposal = components["schemas"]["AssistantProposal"];

export interface ProposalCardState {
  status: Proposal["status"] | "expired";
  hint: boolean;
  failure: string | undefined;
  // What a decided card says under its changes: why it failed, or why to ask again.
  outcome: string | undefined;
  // The screen of the record an executed proposal wrote.
  screen: string | undefined;
}

interface ProposalCardInput {
  shown: Proposal;
  // The expiry instant has passed.
  passed: boolean;
  busy: boolean;
  error: unknown;
  t: TFunction;
}

export function proposalCardState({
  shown,
  passed,
  busy,
  error,
  t,
}: ProposalCardInput): ProposalCardState {
  const status =
    shown.status === "pending" && passed && !busy ? "expired" : shown.status;
  const detail =
    shown.status === "failed" ? failureDetail(shown.result) : undefined;
  const screen =
    shown.status === "executed"
      ? proposalScreen(shown.tool, shown.result)
      : undefined;
  const hint = status === "stale" || status === "expired";
  const failure = error === null ? undefined : errorText(error, t);
  const outcome =
    detail ??
    failure ??
    (hint ? t(`assistant.proposal.hint.${status}`) : undefined);

  return { status, hint, failure, outcome, screen };
}

// The title a card shows for its action; the card of a waiting proposal names its parents with it.
export function actionTitle(action: string, t: TFunction): string {
  const key = catalogKey(`assistant.action.${action}`);

  return key === undefined ? action : t(key);
}

function failureDetail(result: unknown): string | undefined {
  if (typeof result !== "object" || result === null) return undefined;

  const detail = (result as { detail?: unknown }).detail;

  return typeof detail === "string" ? detail : undefined;
}
