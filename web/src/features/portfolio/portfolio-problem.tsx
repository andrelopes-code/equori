import { Alert, AlertContent, AlertDescription } from "@slotted/react/alert";

import { ProblemError } from "@/api/problem";
import { useT } from "@/i18n/i18n-provider";
import { QueryError } from "@/ui/query-error";

// price_missing is the one failure of a report that the valuation currency causes; any other
// failure reads as the generic query error.
export function PortfolioProblem({
  error,
  currency,
  onRetry,
}: {
  error: Error;
  currency: string | undefined;
  onRetry: () => void;
}) {
  const t = useT();
  if (error instanceof ProblemError && error.problem.code === "price_missing")
    return (
      <Alert tone="warning">
        <AlertContent>
          <AlertDescription>
            {t("portfolio.priceMissing", { currency: currency ?? "" })}
          </AlertDescription>
        </AlertContent>
      </Alert>
    );
  return <QueryError error={error} onRetry={onRetry} />;
}
