import { Button } from "@slotted/react/button";
import {
  ResultState,
  ResultStateActions,
  ResultStateContent,
  ResultStateDescription,
  ResultStateTitle,
} from "@slotted/react/result-state";

import { useT } from "@/i18n/i18n-provider";

export function TransactionsEmpty({
  status,
  filtered,
  queue,
  onClear,
  onRetry,
}: {
  status: "empty" | "no-results" | "error";
  // A filter or a search narrowed the list.
  filtered: boolean;
  // The uncategorized queue is shown.
  queue: boolean;
  onClear: () => void;
  onRetry: () => void;
}) {
  const t = useT();
  if (status === "error") {
    return (
      <ResultState status="error">
        <ResultStateContent>
          <ResultStateTitle>{t("transactions.loadFailed")}</ResultStateTitle>
          <ResultStateDescription>
            {t("transactions.loadFailedHint")}
          </ResultStateDescription>
        </ResultStateContent>
        <ResultStateActions>
          <Button variant="outline" tone="secondary" onClick={onRetry}>
            {t("transactions.tryAgain")}
          </Button>
        </ResultStateActions>
      </ResultState>
    );
  }
  if (filtered) {
    return (
      <ResultState status="no-results">
        <ResultStateContent>
          <ResultStateTitle>{t("transactions.noResults")}</ResultStateTitle>
          <ResultStateDescription>
            {t("transactions.noResultsHint")}
          </ResultStateDescription>
        </ResultStateContent>
        <ResultStateActions>
          <Button variant="outline" tone="secondary" onClick={onClear}>
            {t("transactions.clearFilters")}
          </Button>
        </ResultStateActions>
      </ResultState>
    );
  }
  return (
    <ResultState status={queue ? "success" : "empty"}>
      <ResultStateContent>
        <ResultStateTitle>
          {queue ? t("transactions.queueDone") : t("transactions.empty")}
        </ResultStateTitle>
        <ResultStateDescription>
          {queue
            ? t("transactions.queueDoneHint")
            : t("transactions.emptyHint")}
        </ResultStateDescription>
      </ResultStateContent>
    </ResultState>
  );
}
