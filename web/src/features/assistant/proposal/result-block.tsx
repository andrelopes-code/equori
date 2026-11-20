import { Link } from "@slotted/react/link";
import { Text } from "@slotted/react/typography";

import type { components } from "@/api/schema.gen";
import { actionIcon } from "@/features/assistant/message/source-icon";
import { AssistantIcon } from "@/features/assistant/panel/assistant-icon";
import {
  actionTitle,
  proposalCardState,
} from "@/features/assistant/proposal/proposal-card-state";
import { OperationBody } from "@/features/assistant/proposal/bodies/operation-body";
import { ResultLabel } from "@/features/assistant/proposal/result-label";
import styles from "@/features/assistant/proposal/results.module.css";
import { useExpired } from "@/features/assistant/proposal/use-expired";
import { useValueText } from "@/features/assistant/proposal/use-value-text";
import { UndoAction } from "@/features/assistant/undo/undo-action";
import { useT } from "@/i18n/i18n-provider";
import { routeTo } from "@/ui/navigation/route-to";
import { useServed } from "@/ui/navigation/use-served";

type Proposal = components["schemas"]["AssistantProposal"];

interface ResultBlockProps {
  proposal: Proposal;
}

// Families read: link, typography. Any decided proposal that is not a receipt: its icon tile,
// action and target, the state word, the values it wrote and what the reader does next (spec
// 2026-11-15, section 5).
export function ResultBlock({ proposal }: ResultBlockProps) {
  const t = useT();
  const served = useServed();
  const valueText = useValueText();

  // A pending proposal past its expiry instant is an expired result (P15).
  const passed = useExpired(proposal.expires_at, proposal.status === "pending");
  const { status, hint, outcome, screen } = proposalCardState({
    shown: proposal,
    passed,
    busy: false,
    error: null,
    t,
  });
  const { preview } = proposal;
  const failed = status === "failed";
  const opens = screen !== undefined && served({ href: screen });

  return (
    <article className={hint ? styles.blockMuted : styles.block}>
      <div className={styles.head}>
        <span className={styles.tile}>
          <span className={styles.icon16}>
            <AssistantIcon name={actionIcon(proposal.tool)} />
          </span>
        </span>

        <span className={styles.title}>
          <Text size="sm" weight="semibold" tone={hint ? "muted" : "inherit"}>
            {actionTitle(preview.action, t)}
          </Text>
          {preview.target !== undefined && (
            <Text size="xs" tone="muted">
              {valueText({ text: preview.target })}
            </Text>
          )}
        </span>

        <ResultLabel
          status={proposal.undone_by === undefined ? status : "undone"}
        />
      </div>

      <OperationBody preview={preview} />

      {failed && (
        <Text size="sm" className={styles.failure} role="status">
          {`${t("assistant.result.not_applied")} ${outcome ?? ""}`.trim()}
        </Text>
      )}

      {hint && outcome !== undefined && (
        <Text size="sm" tone="muted">
          {outcome}
        </Text>
      )}

      {status === "blocked" && (
        <Text size="sm" tone="muted">
          {t("assistant.proposal.blocked")}
        </Text>
      )}

      {opens && (
        <Text size="sm">
          <Link render={routeTo({ href: screen })}>
            {t("assistant.proposal.open")}
          </Link>
        </Text>
      )}

      <UndoAction proposal={proposal} labelled />
    </article>
  );
}
