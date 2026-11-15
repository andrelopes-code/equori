import type { components } from "@/api/schema.gen";

type Proposal = components["schemas"]["AssistantProposal"];

export interface SheetRow {
  proposal: Proposal;
  // The waiting proposals of the answer that name this one first in waiting_for.
  dependents: Proposal[];
}

export interface SheetModel {
  // Pending, executing and waiting proposals without a parent in the answer, in the answer's order.
  rows: SheetRow[];
  // Every other proposal, in the answer's order.
  results: Proposal[];
  // The open proposal that expires first; undefined when rows is empty.
  deadline: Proposal | undefined;
}

export interface SheetSummary {
  marked: number;
  total: number;
  irreversible: number;
  left: number;
}

const OPEN: readonly Proposal["status"][] = ["pending", "executing", "waiting"];

export function sheetModel(proposals: readonly Proposal[]): SheetModel {
  const open = proposals.filter(isOpen);
  const openIDs = new Set(open.map((proposal) => proposal.id));
  const rows: SheetRow[] = open
    .filter((proposal) => !hasParent(proposal, openIDs))
    .map((proposal) => ({
      proposal,
      dependents: open.filter(
        (other) =>
          hasParent(other, openIDs) && other.waiting_for[0] === proposal.id,
      ),
    }));
  const results = proposals.filter((proposal) => !isOpen(proposal));

  return { rows, results, deadline: earliest(open) };
}

export function defaultMarks(
  proposals: readonly Proposal[],
): Record<string, boolean> {
  const marks: Record<string, boolean> = {};

  for (const proposal of proposals) {
    if (proposal.status === "pending") {
      marks[proposal.id] = proposal.preview.destructive !== true;
    }
  }

  return marks;
}

// Counts over the rows' pending proposals only.
export function sheetSummary(
  rows: readonly SheetRow[],
  marks: Record<string, boolean>,
): SheetSummary {
  const pending = rows
    .map((row) => row.proposal)
    .filter((proposal) => proposal.status === "pending");
  const marked = pending.filter((proposal) => marks[proposal.id] === true);
  const irreversible = marked.filter(
    (proposal) => proposal.preview.destructive === true,
  );

  return {
    marked: marked.length,
    total: pending.length,
    irreversible: irreversible.length,
    left: pending.length - marked.length,
  };
}

// The share of time left, clamped to 0..1.
export function timeLeft(proposal: Proposal, now: number): number {
  const created = Date.parse(proposal.created_at);
  const expires = Date.parse(proposal.expires_at);
  const share = (expires - now) / (expires - created);

  return Math.min(1, Math.max(0, share));
}

function isOpen(proposal: Proposal): boolean {
  return OPEN.includes(proposal.status);
}

function hasParent(proposal: Proposal, openIDs: ReadonlySet<string>): boolean {
  const parent = proposal.waiting_for[0];

  return (
    proposal.status === "waiting" && parent !== undefined && openIDs.has(parent)
  );
}

function earliest(open: readonly Proposal[]): Proposal | undefined {
  return open.reduce<Proposal | undefined>(
    (best, proposal) =>
      best === undefined ||
      Date.parse(proposal.expires_at) < Date.parse(best.expires_at)
        ? proposal
        : best,
    undefined,
  );
}
