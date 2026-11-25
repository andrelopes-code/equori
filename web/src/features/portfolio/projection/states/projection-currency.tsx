import { Button } from "@slotted/react/button";
import {
  ResultState,
  ResultStateActions,
  ResultStateContent,
  ResultStateDescription,
  ResultStateTitle,
} from "@slotted/react/result-state";

import { useT } from "@/i18n/i18n-provider";

interface ProjectionCurrencyProps {
  plan: string;
  base: string;
  deleting: boolean;
  onDelete: () => void;
}

// PX12: the plan is in a currency the book no longer uses; the action deletes it.
export function ProjectionCurrency({
  plan,
  base,
  deleting,
  onDelete,
}: ProjectionCurrencyProps) {
  const t = useT();

  return (
    <ResultState status="empty" reach="section">
      <ResultStateContent>
        <ResultStateTitle>
          {t("portfolio.projection.currency.title")}
        </ResultStateTitle>
        <ResultStateDescription>
          {t("portfolio.projection.currency.description", { plan, base })}
        </ResultStateDescription>
      </ResultStateContent>

      <ResultStateActions>
        <Button disabled={deleting} onClick={onDelete}>
          {t("portfolio.projection.currency.delete")}
        </Button>
      </ResultStateActions>
    </ResultState>
  );
}
