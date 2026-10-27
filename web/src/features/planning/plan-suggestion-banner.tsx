import {
  Alert,
  AlertActions,
  AlertContent,
  AlertDescription,
} from "@slotted/react/alert";
import { Button } from "@slotted/react/button";
import { Switch } from "@slotted/react/switch";

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
    <Alert tone="accent">
      <AlertContent>
        <AlertDescription>{summary}</AlertDescription>
      </AlertContent>
      <AlertActions>
        {canFit && (
          <Switch
            checked={fit}
            onCheckedChange={(next) => {
              onFit(next);
            }}
          >
            {t("plan.fit")}
          </Switch>
        )}
        <Button variant="ghost" tone="secondary" size="sm" onClick={onDiscard}>
          {t("plan.discard")}
        </Button>
        <Button size="sm" disabled={checked === 0} onClick={onApply}>
          {checked === 1
            ? t("plan.applyOne")
            : t("plan.applyChecked", { count: String(checked) })}
        </Button>
      </AlertActions>
    </Alert>
  );
}
