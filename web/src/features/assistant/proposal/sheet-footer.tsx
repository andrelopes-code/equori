import { Button } from "@slotted/react/button";
import { Text } from "@slotted/react/typography";
import { useEffect, useRef } from "react";

import styles from "@/features/assistant/proposal/decision-sheet.module.css";
import type { SheetSummary } from "@/features/assistant/proposal/sheet-model";
import { useT } from "@/i18n/i18n-provider";
import type { TFunction } from "@/i18n/i18n-provider";

interface SheetFooterProps {
  summary: SheetSummary;
  // A confirm or a reject of the sheet is running.
  running: boolean;
  // The footer of a new answer scrolls into view (P13).
  reveal: boolean;
  onConfirm: () => void;
  onReject: () => void;
}

// Families read: button, typography. What the sheet will do with the marks, and the two decisions.
export function SheetFooter({
  summary,
  running,
  reveal,
  onConfirm,
  onReject,
}: SheetFooterProps) {
  const t = useT();
  const footer = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (reveal) footer.current?.scrollIntoView({ block: "nearest" });
  }, [reveal]);

  const danger = summary.irreversible > 0;
  const consequence = consequenceText(summary, t);

  return (
    <div className={styles.footer} ref={footer} data-sheet-footer="">
      <span className={styles.summary}>
        <Text size="sm">
          {t("assistant.sheet.marked", {
            marked: summary.marked,
            total: summary.total,
          })}
        </Text>
        <Text size="xs" tone={danger ? "danger" : "muted"}>
          {consequence}
        </Text>
      </span>

      <Button
        variant="ghost"
        tone="secondary"
        disabled={running || summary.marked === 0}
        onClick={onReject}
      >
        {t("assistant.proposal.reject")}
      </Button>
      <Button
        tone={danger ? "danger" : "accent"}
        disabled={running || summary.marked === 0}
        onClick={onConfirm}
      >
        {t("assistant.sheet.confirm", { count: summary.marked })}
      </Button>
    </div>
  );
}

// The second line of the summary: what cannot be undone, what stays, or that everything applies.
function consequenceText(summary: SheetSummary, t: TFunction): string {
  const { irreversible, left } = summary;

  if (irreversible > 0) {
    return irreversible === 1
      ? t("assistant.sheet.irreversible.one")
      : t("assistant.sheet.irreversible.many", { count: irreversible });
  }

  if (left > 0) {
    return left === 1
      ? t("assistant.sheet.left.one")
      : t("assistant.sheet.left.many", { count: left });
  }

  return t("assistant.sheet.all");
}
