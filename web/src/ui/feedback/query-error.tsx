import { Button } from "@slotted/react/button";
import {
  ResultState,
  ResultStateActions,
  ResultStateContent,
  ResultStateDescription,
  ResultStateTitle,
} from "@slotted/react/result-state";

import { ProblemError, problemMessage } from "@/api/problem";
import { useT } from "@/i18n/i18n-provider";

export function QueryError({
  error,
  onRetry,
}: {
  error: Error;
  onRetry: () => void;
}) {
  const t = useT();
  return (
    <ResultState status="error" reach="section">
      <ResultStateContent>
        <ResultStateTitle>{t("common.error.title")}</ResultStateTitle>
        {error instanceof ProblemError && (
          <ResultStateDescription>
            {problemMessage(error.problem, t)}
          </ResultStateDescription>
        )}
      </ResultStateContent>
      <ResultStateActions>
        <Button onClick={onRetry}>{t("common.retry")}</Button>
      </ResultStateActions>
    </ResultState>
  );
}
