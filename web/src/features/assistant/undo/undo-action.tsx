import { Button } from "@slotted/react/button";
import { Text } from "@slotted/react/typography";

import type { components } from "@/api/schema.gen";
import { useUndoProposal } from "@/features/assistant/api";
import { AssistantIcon } from "@/features/assistant/panel/assistant-icon";
import styles from "@/features/assistant/undo/undo-action.module.css";
import { undoState } from "@/features/assistant/undo/undo-state";
import { useT } from "@/i18n/i18n-provider";
import { cx } from "@/ui/cx";

type Proposal = components["schemas"]["AssistantProposal"];

interface UndoActionProps {
  proposal: Proposal;
  // Places the control inside its container, such as the inset of a sheet row.
  className?: string | undefined;
  // The container writes "undone" in its state word, so a reversed proposal needs no line here.
  labelled?: boolean;
}

// Families read: button, typography. Desfazer under an executed write whose tool has an exact
// inverse; the click is the confirmation, and the word Desfeita replaces it once the inverse ran
// (answer views design V19).
export function UndoAction({
  proposal,
  className,
  labelled = false,
}: UndoActionProps) {
  const t = useT();
  const undo = useUndoProposal();

  const state = undoState(proposal, undo.data, undo.error, t);

  function handleUndo() {
    undo.mutate({ id: proposal.id, reason: t("assistant.undo.reason") });
  }

  if (state.kind === "none") return null;

  if (state.kind === "done" && labelled && proposal.undone_by !== undefined) {
    return null;
  }

  if (state.kind === "done") {
    return (
      <div className={cx(styles.undo, className)}>
        <Text size="sm" tone="muted">
          {t("assistant.undo.done")}
        </Text>
      </div>
    );
  }

  return (
    <div className={cx(styles.undo, className)}>
      {state.failure !== undefined && (
        <Text
          size="sm"
          tone="danger"
          role="status"
          className={styles.failure}
          title={state.failure}
        >
          {state.failure}
        </Text>
      )}

      <Button
        size="sm"
        variant="ghost"
        loading={undo.isPending}
        onClick={handleUndo}
        start={
          <span className={styles.icon}>
            <AssistantIcon name="undo" />
          </span>
        }
      >
        {t("assistant.undo.action")}
      </Button>
    </div>
  );
}
