import { Button } from "@slotted/react/button";

import type { components } from "@/api/schema.gen";
import styles from "@/features/transactions/reimbursement/reimbursement-dialog.module.css";
import { useT } from "@/i18n/i18n-provider";

type Candidate = components["schemas"]["ReimbursementCandidate"];

export interface ReimbursementExactMatchProps {
  items: readonly Candidate[];
  suggestion: readonly string[];
  onApply: () => void;
}

// RD8: the expenses whose remaining amounts add up to the inflow, named on one line.
export function ReimbursementExactMatch({
  items,
  suggestion,
  onApply,
}: ReimbursementExactMatchProps) {
  const t = useT();

  const names = items
    .filter((item) => suggestion.includes(item.transaction.id))
    .map((item) => item.transaction.description);
  if (names.length === 0) return null;

  return (
    <div className={styles.suggest}>
      <p className={styles.suggestText}>
        <span className={styles.suggestLead}>{t("reimbursement.exact")}</span>
        <span className={styles.name}>{names.join(", ")}</span>
      </p>

      <Button size="sm" variant="outline" tone="secondary" onClick={onApply}>
        {t("reimbursement.exactApply")}
      </Button>
    </div>
  );
}
