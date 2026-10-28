import {
  Alert,
  AlertActions,
  AlertContent,
  AlertDescription,
} from "@slotted/react/alert";
import { Button } from "@slotted/react/button";
import { Switch } from "@slotted/react/switch";

import styles from "@/features/planning/budget-plan.module.css";
import { useT } from "@/i18n/i18n-provider";

// The suggestion under review (A132): what it changes and leaves, the fit to the reference
// when it would pass it, and the two ways out. Nothing is written before Apply.
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
    <Alert actionsPlacement="end">
      <AlertContent>
        <AlertDescription>{summary}</AlertDescription>
      </AlertContent>
      <AlertActions>
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
        <Button variant="ghost" onClick={onDiscard}>
          {t("plan.discard")}
        </Button>
        <Button disabled={checked === 0} onClick={onApply}>
          {checked === 1
            ? t("plan.applyOne")
            : t("plan.applyChecked", { count: String(checked) })}
        </Button>
      </AlertActions>
    </Alert>
  );
}
