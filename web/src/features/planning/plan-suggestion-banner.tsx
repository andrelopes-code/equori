import { Button } from "@slotted/react/button";
import { Glyph, Icon } from "@slotted/react/icon";
import { Switch } from "@slotted/react/switch";
import { Text } from "@slotted/react/typography";

import styles from "@/features/planning/budget-plan.module.css";
import { useT } from "@/i18n/i18n-provider";

// The suggestion under review (A132): what it changes and leaves, the fit to the reference
// when it would pass it, and the two ways out. Nothing is written before Apply.
// Workaround for Slotted finding "An alert cannot hold its actions at the end of a one-line message":
// the alert puts its actions on a row under the text, so the banner is drawn here on the
// alert's accent tokens with the actions at the end of its one line.
export function PlanSuggestionBanner({
  summary,
  checked,
  fit,
  canFit,
  onFit,
  onApply,
  onDiscard,
}: {
  summary: string;
  checked: number;
  fit: boolean;
  canFit: boolean;
  onFit: (fit: boolean) => void;
  onApply: () => void;
  onDiscard: () => void;
}) {
  const t = useT();
  return (
    <div className={styles.review}>
      <span className={styles.reviewMark} aria-hidden="true">
        <Icon>
          <Glyph name="status-info" />
        </Icon>
      </span>
      <Text size="sm" className={styles.reviewText}>
        {summary}
      </Text>
      <div className={styles.reviewActions}>
        {canFit && (
          <Switch
            size="sm"
            checked={fit}
            onCheckedChange={(next) => {
              onFit(next);
            }}
          >
            {t("plan.fit")}
          </Switch>
        )}
        {canFit && <span className={styles.reviewRule} aria-hidden="true" />}
        <Button variant="ghost" tone="secondary" size="sm" onClick={onDiscard}>
          {t("plan.discard")}
        </Button>
        <Button size="sm" disabled={checked === 0} onClick={onApply}>
          {checked === 1
            ? t("plan.applyOne")
            : t("plan.applyChecked", { count: String(checked) })}
        </Button>
      </div>
    </div>
  );
}
