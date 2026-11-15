import { Checkbox } from "@slotted/react/checkbox";
import { Text } from "@slotted/react/typography";

import { errorText } from "@/api/problem";
import type { components } from "@/api/schema.gen";
import { actionIcon } from "@/features/assistant/message/source-icon";
import { AssistantIcon } from "@/features/assistant/panel/assistant-icon";
import styles from "@/features/assistant/proposal/decision-sheet.module.css";
import {
  actionTitle,
  proposalCardState,
} from "@/features/assistant/proposal/proposal-card-state";
import { OperationBody } from "@/features/assistant/proposal/operation-body";
import { ProposalWaiting } from "@/features/assistant/proposal/proposal-waiting";
import { RowEnd } from "@/features/assistant/proposal/row-end";
import { targetShownElsewhere } from "@/features/assistant/proposal/target-shown";
import { useValueText } from "@/features/assistant/proposal/use-value-text";
import { useT } from "@/i18n/i18n-provider";

type Proposal = components["schemas"]["AssistantProposal"];

interface OperationRowProps {
  proposal: Proposal;
  // The proposals of the answer, where a waiting row finds the proposals it waits for.
  siblings: readonly Proposal[];
  marked: boolean;
  // The expiry instant has passed while the proposal waited for a decision (P15).
  expired: boolean;
  // A confirm or a reject of the sheet is running.
  locked: boolean;
  // This proposal's request is in flight.
  executing: boolean;
  // Why the last decision did not reach the server.
  error: unknown;
  onToggle: (id: string) => void;
}

// Families read: checkbox, typography. One proposal of the sheet: its mark, its icon tile, its
// action, the tags that qualify it and, under the row, what it does and why.
export function OperationRow({
  proposal,
  siblings,
  marked,
  expired,
  locked,
  executing,
  error,
  onToggle,
}: OperationRowProps) {
  const t = useT();
  const valueText = useValueText();
  const { preview } = proposal;
  const title = actionTitle(preview.action, t);
  const repeated = targetShownElsewhere(preview);
  const destructive = preview.destructive === true;
  const running = executing || proposal.status === "executing";
  const state = proposalCardState({
    shown: proposal,
    passed: expired,
    busy: running,
    error: null,
    t,
  });
  const decided = !["pending", "executing", "waiting"].includes(state.status);
  const failure = error === undefined ? undefined : errorText(error, t);

  function handleToggle() {
    onToggle(proposal.id);
  }

  return (
    <div className={styles.op}>
      <div className={styles.opHead}>
        {decided ? (
          <span aria-hidden="true" />
        ) : (
          <Checkbox
            size="sm"
            aria-label={title}
            checked={marked}
            disabled={locked || running || proposal.status !== "pending"}
            onChange={handleToggle}
          />
        )}

        <span className={destructive ? styles.tileDanger : styles.tile}>
          <span className={styles.icon16}>
            <AssistantIcon name={actionIcon(proposal.tool)} />
          </span>
        </span>

        <span className={styles.opTitle}>
          <Text className={styles.titleText} size="md" weight="semibold">
            {title}
          </Text>
          {proposal.suggested && (
            <span className={styles.tag}>
              {t("assistant.proposal.suggested")}
            </span>
          )}
          {destructive && (
            <span className={styles.tagDanger}>
              {t("assistant.sheet.irreversible_tag")}
            </span>
          )}
        </span>

        <RowEnd status={state.status} running={running} screen={state.screen} />
      </div>

      {state.status === "failed" && (
        <div className={styles.opBody}>
          <Text size="sm" tone="danger" role="status">
            {`${t("assistant.result.not_applied")} ${state.outcome ?? ""}`.trim()}
          </Text>
        </div>
      )}

      {!decided && (
        <div className={styles.opBody}>
          {preview.target !== undefined && !repeated && (
            <Text size="sm" tone="muted">
              {valueText({ text: preview.target })}
            </Text>
          )}

          {proposal.status === "waiting" ? (
            <ProposalWaiting proposal={proposal} siblings={siblings} />
          ) : (
            <OperationBody preview={preview} />
          )}

          {proposal.suggested && proposal.reason !== undefined && (
            <div className={styles.why}>
              <span className={styles.icon14}>
                <AssistantIcon name="info" />
              </span>
              <Text size="sm" tone="muted">
                {proposal.reason}
              </Text>
            </div>
          )}

          {failure !== undefined && (
            <Text size="sm" tone="danger" role="status">
              {failure}
            </Text>
          )}
        </div>
      )}
    </div>
  );
}
