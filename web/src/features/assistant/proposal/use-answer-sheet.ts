import { useEffect, useState } from "react";

import type { components } from "@/api/schema.gen";
import { sheetModel } from "@/features/assistant/proposal/sheet-model";
import type { SheetModel } from "@/features/assistant/proposal/sheet-model";
import type { Decision } from "@/features/assistant/proposal/use-sheet-decisions";

type Proposal = components["schemas"]["AssistantProposal"];

// The clock moves at least this often while a proposal is open, so the deadline ring stays true.
const tick = 30_000;

// A delay over 2^31 - 1 ms fires at once; an instant that far needs no timer.
const maxDelay = 2 ** 31 - 1;

export interface AnswerSheet extends SheetModel {
  // The instant of the last tick or expiry.
  now: number;
}

// The sheet of one answer after the decisions already taken: a decided proposal shows the server's
// answer, and a pending one leaves the rows at its expiry instant, without a click (P15).
export function useAnswerSheet(
  proposals: readonly Proposal[],
  decisions: Record<string, Decision>,
): AnswerSheet {
  const decided = proposals.map((p) => decisions[p.id]?.proposal ?? p);
  const now = useClock(
    decided.filter((p) => p.status === "pending").map(expiry),
  );
  const model = sheetModel(
    decided.filter((p) => p.status !== "pending" || expiry(p) > now),
  );
  const shown = new Set(
    model.rows.flatMap((row) => [
      row.proposal.id,
      ...row.dependents.map((d) => d.id),
    ]),
  );

  return { ...model, results: decided.filter((p) => !shown.has(p.id)), now };
}

function useClock(instants: readonly number[]): number {
  const [now, setNow] = useState(() => Date.now());
  const next = Math.min(...instants.filter((at) => at > now));

  useEffect(() => {
    if (!Number.isFinite(next)) return;

    const left = Math.max(0, next - Date.now());
    const expire =
      left > maxDelay
        ? undefined
        : setTimeout(() => {
            setNow(Math.max(Date.now(), next));
          }, left);
    const refresh = setInterval(() => {
      setNow(Date.now());
    }, tick);

    return () => {
      clearTimeout(expire);
      clearInterval(refresh);
    };
  }, [next]);

  return now;
}

function expiry(proposal: Proposal): number {
  return Date.parse(proposal.expires_at);
}
