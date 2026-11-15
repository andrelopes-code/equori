import { Text } from "@slotted/react/typography";
import { Fragment } from "react";

import type { components } from "@/api/schema.gen";
import { DeadlineRing } from "@/features/assistant/proposal/deadline-ring";
import styles from "@/features/assistant/proposal/decision-sheet.module.css";
import { DependentRow } from "@/features/assistant/proposal/dependent-row";
import { OperationRow } from "@/features/assistant/proposal/operation-row";
import { SheetFooter } from "@/features/assistant/proposal/sheet-footer";
import {
  sheetSummary,
  timeLeft,
} from "@/features/assistant/proposal/sheet-model";
import type { SheetRow } from "@/features/assistant/proposal/sheet-model";
import { useSheetDecisions } from "@/features/assistant/proposal/use-sheet-decisions";
import type { Decision } from "@/features/assistant/proposal/use-sheet-decisions";
import { useAppLocale, useT } from "@/i18n/i18n-provider";

type Proposal = components["schemas"]["AssistantProposal"];

interface DecisionSheetProps {
  rows: readonly SheetRow[];
  // The open proposal that expires first.
  deadline: Proposal | undefined;
  // Every proposal of the answer, where a waiting row finds the proposals it waits for.
  siblings: readonly Proposal[];
  // The instant the deadline ring is drawn for.
  now: number;
  // The answer just arrived; the footer comes into view (P13).
  reveal: boolean;
  onDecided: (id: string, decision: Decision) => void;
}

// Families read: typography. The open proposals of one answer as one decision: the deadline once,
// the operations with their marks, and one confirm for the marked ones (spec 2026-11-15, section 4).
export function DecisionSheet({
  rows,
  deadline,
  now,
  siblings,
  reveal,
  onDecided,
}: DecisionSheetProps) {
  const t = useT();
  const [locale] = useAppLocale();
  const decisions = useSheetDecisions(rows, onDecided);

  if (rows.length === 0) return null;

  const count = rows.reduce((sum, row) => sum + 1 + row.dependents.length, 0);
  const live = rows.filter((row) => !passed(row.proposal, now));
  const summary = sheetSummary(live, decisions.marks);
  const until =
    deadline === undefined
      ? undefined
      : new Intl.DateTimeFormat(locale, {
          hour: "numeric",
          minute: "2-digit",
        }).format(new Date(deadline.expires_at));

  return (
    <section className={styles.sheet}>
      <div className={styles.header}>
        <Text size="md" weight="semibold">
          {count === 1
            ? t("assistant.sheet.title.one")
            : t("assistant.sheet.title.many", { count })}
        </Text>

        {deadline !== undefined && until !== undefined && (
          <span className={styles.deadline}>
            <DeadlineRing share={timeLeft(deadline, now)} size={16} />
            <Text size="xs" tone="muted">
              {t("assistant.sheet.until", { time: until })}
            </Text>
          </span>
        )}
      </div>

      {rows.map(({ proposal, dependents }) => (
        <Fragment key={proposal.id}>
          <OperationRow
            proposal={proposal}
            siblings={siblings}
            marked={decisions.marks[proposal.id] === true}
            expired={passed(proposal, now)}
            locked={decisions.running}
            executing={decisions.active === proposal.id}
            error={decisions.errors[proposal.id]}
            onToggle={decisions.toggle}
          />

          {dependents.map((dependent) => (
            <DependentRow
              key={dependent.id}
              proposal={dependent}
              marked={decisions.marks[proposal.id] === true}
            />
          ))}
        </Fragment>
      ))}

      {summary.total > 0 && (
        <SheetFooter
          summary={summary}
          running={decisions.running}
          reveal={reveal}
          onConfirm={decisions.confirm}
          onReject={decisions.reject}
        />
      )}
    </section>
  );
}

// A pending proposal whose expiry instant is at or before now (P15).
function passed(proposal: Proposal, now: number): boolean {
  return (
    proposal.status === "pending" && Date.parse(proposal.expires_at) <= now
  );
}
