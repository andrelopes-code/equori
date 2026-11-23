import type { components } from "@/api/schema.gen";
import type { MemberDraft } from "@/features/portfolio/contribution-plan/model/plan-draft";

type Group = components["schemas"]["ContributionClass"];
type Detail = components["schemas"]["ContributionFactDetail"];

// What a cell of the board draws: the answer equori gives with the figure it read, the investor's
// own answer (with the reason equori gives none), or the wait for the preview.
export type CellAnswer =
  | { kind: "automatic"; yes: boolean; detail: Detail }
  | { kind: "own"; yes: boolean; reason: string | undefined }
  | { kind: "pending" };

interface CellInput {
  // The class of the last preview; its criteria may lag the draft.
  answered: Group | undefined;
  member: MemberDraft;
  fact: string;
  limit: string;
  // The stored answer of the investor.
  stored: boolean;
  // Whether the preview can answer the criterion: a limit is set.
  complete: boolean;
}

// The answer of one asset to one criterion. The figure comes from the preview of the same fact and
// limit, so a criterion just added or removed never reads the figure of another.
export function cellAnswer({
  answered,
  member,
  fact,
  limit,
  stored,
  complete,
}: CellInput): CellAnswer {
  const own = { kind: "own", yes: stored, reason: undefined } as const;

  if (fact === "" || !complete) return own;

  const at = answered?.question_facts.findIndex(
    (key, q) => key === fact && answered.question_limits[q] === limit,
  );
  const row = answered?.members.find(
    (m) =>
      (member.instrument !== undefined && m.instrument === member.instrument) ||
      (member.accountId !== undefined && m.account_id === member.accountId),
  );
  const answer = at === undefined ? undefined : row?.fact_answers?.[at];

  if (at === undefined || answer === undefined) return { kind: "pending" };

  const detail = row?.fact_details?.[at] ?? {};

  return answer === "none"
    ? { ...own, reason: detail.reason ?? "missing" }
    : { kind: "automatic", yes: answer === "yes", detail };
}

// The points of an asset: its cells that answer yes; a pending cell counts the stored answer.
export function cellPoints(cells: CellAnswer[], stored: boolean[]): number {
  return cells.filter((cell, q) =>
    cell.kind === "pending" ? (stored[q] ?? false) : cell.yes,
  ).length;
}
