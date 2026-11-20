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
  // Every other proposal, in the answer's order: the ones that arrived already decided.
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

// sessionProposals gives each proposal decided in this session the server's answer to the
// decision; an undo that later reversed it, which the refreshed answer carries, applies over it
// (answer views design V19).
export function sessionProposals(
  proposals: readonly Proposal[],
  decisions: Readonly<Record<string, { proposal?: Proposal }>>,
): Proposal[] {
  return proposals.map((p) => {
    const session = decisions[p.id]?.proposal;
    if (session === undefined) return p;

    return p.undone_by === undefined
      ? session
      : { ...session, undoable: false, undone_by: p.undone_by };
  });
}

// `session` holds the proposals decided since the answer arrived: they stay rows, with their
// outcome, instead of becoming results.
export function sheetModel(
  proposals: readonly Proposal[],
  session: ReadonlySet<string> = new Set(),
): SheetModel {
  const kept = (proposal: Proposal) =>
    isOpen(proposal) || session.has(proposal.id);
  const shown = proposals.filter(kept);
  const keptIDs = new Set(shown.map((proposal) => proposal.id));
  const rows: SheetRow[] = shown
    .filter((proposal) => !hasParent(proposal, keptIDs, session))
    .map((proposal) => ({
      proposal,
      dependents: shown.filter(
        (other) =>
          hasParent(other, keptIDs, session) &&
          other.waiting_for[0] === proposal.id,
      ),
    }));
  const results = proposals.filter((proposal) => !kept(proposal));

  return { rows, results, deadline: earliest(proposals.filter(isOpen)) };
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

function hasParent(
  proposal: Proposal,
  shownIDs: ReadonlySet<string>,
  session: ReadonlySet<string>,
): boolean {
  const parent = proposal.waiting_for[0];
  const waits = proposal.status === "waiting" || session.has(proposal.id);

  return waits && parent !== undefined && shownIDs.has(parent);
}

export function earliest(open: readonly Proposal[]): Proposal | undefined {
  return open.reduce<Proposal | undefined>(
    (best, proposal) =>
      best === undefined ||
      Date.parse(proposal.expires_at) < Date.parse(best.expires_at)
        ? proposal
        : best,
    undefined,
  );
}
