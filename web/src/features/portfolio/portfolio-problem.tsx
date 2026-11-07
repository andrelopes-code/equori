import { ProblemError } from "@/api/problem";
import { PriceMissingNotice } from "@/features/portfolio/price-missing-notice";
import type { PriceMissingProps } from "@/features/portfolio/price-missing-notice";
import { QueryError } from "@/ui/query-error";

interface PortfolioProblemProps extends PriceMissingProps {
  error: Error;
  onRetry: () => void;
}

// price_missing is the one failure of a report that the valuation currency causes; any other
// failure reads as the generic query error.
export function PortfolioProblem({
  error,
  onRetry,
  ...notice
}: PortfolioProblemProps) {
  if (error instanceof ProblemError && error.problem.code === "price_missing")
    return <PriceMissingNotice {...notice} />;

  return <QueryError error={error} onRetry={onRetry} />;
}
