import { Text } from "@slotted/react/typography";
import { TextField } from "@slotted/react/text-field";

import styles from "@/features/portfolio/contribution-plan/criteria/board/board.module.css";
import { LimitField } from "@/features/portfolio/contribution-plan/criteria/board/limit-field";
import { limitCriterion } from "@/features/portfolio/contribution-plan/criteria/model/criteria-catalog";
import type { BoardRow } from "@/features/portfolio/contribution-plan/criteria/model/board-rows";
import { RemoveButton } from "@/features/portfolio/contribution-plan/editor/remove-button";
import type { MessageKey } from "@/i18n/catalog.en";
import { useT } from "@/i18n/i18n-provider";

interface CriterionHeadProps {
  row: BoardRow;
  // The position of the criterion, from 1.
  n: number;
  // The text in the active language.
  text: string;
  // Focuses the field of a criterion just added.
  fresh: boolean;
  onText: (text: string) => void;
  onLimit: (limit: string) => void;
  onRemove: () => void;
}

const notes: Record<BoardRow["state"], MessageKey> = {
  ok: "contributionPlan.criteria.noteAutomatic",
  noLimit: "contributionPlan.criteria.noteNoLimit",
  blank: "contributionPlan.criteria.noteBlank",
  repeated: "contributionPlan.criteria.noteRepeated",
};

// The head of a row: the field of an own criterion, or the text and the limit of an automatic one,
// then the remove action.
export function CriterionHead({
  row,
  n,
  text,
  fresh,
  onText,
  onLimit,
  onRemove,
}: CriterionHeadProps) {
  const t = useT();

  const criterion = limitCriterion(row.fact);
  const own = row.fact === "";
  const name =
    text.trim() === ""
      ? t("contributionPlan.criteria.unnamed", { n: String(n) })
      : text;

  return (
    <div role="rowheader" aria-label={name} className={styles.criterion}>
      {own && (
        <TextField
          className={styles.ownField}
          size="sm"
          maxLength={200}
          autoComplete="off"
          autoFocus={fresh}
          invalid={row.state !== "ok"}
          placeholder={t("contributionPlan.criteria.ownPlaceholder")}
          aria-label={t("contributionPlan.criteria.ownLabel", {
            n: String(n),
          })}
          title={text}
          value={row.text}
          onChange={(event) => {
            onText(event.target.value);
          }}
        />
      )}

      {!own && (
        <div className={styles.criterionText}>
          <Text size="sm" truncate title={text}>
            {text}
          </Text>

          <Text size="xs" tone={row.state === "ok" ? "muted" : "danger"}>
            {t(notes[row.state])}
          </Text>
        </div>
      )}

      {criterion !== undefined && (
        <LimitField
          criterion={criterion}
          limit={row.limit}
          invalid={row.state === "noLimit"}
          onChange={onLimit}
        />
      )}

      <RemoveButton
        label={t("contributionPlan.criteria.remove", { name })}
        onRemove={onRemove}
      />
    </div>
  );
}
