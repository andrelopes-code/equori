import { ResultsLoaded } from "@/features/portfolio/results/results-loaded";
import { ResultsPeriodBar } from "@/features/portfolio/results/period-bar/results-period-bar";
import { ResultsEmpty } from "@/features/portfolio/results/states/results-empty";
import { ResultsFailed } from "@/features/portfolio/results/states/results-failed";
import { ResultsPending } from "@/features/portfolio/results/states/results-pending";
import type { useResults } from "@/features/portfolio/results/use-results";

interface ResultsBodyProps {
  results: ReturnType<typeof useResults>;
}

// PR11: the body of the results tab by the state of the history read: empty, pending, failed or
// drawn. An empty portfolio is a history with no point.
export function ResultsBody({ results }: ResultsBodyProps) {
  const { history } = results;

  function handleRetry() {
    void history.refetch();
  }

  if (history.data?.points.length === 0) return <ResultsEmpty />;

  return (
    <>
      <ResultsPeriodBar />

      {history.isPending && <ResultsPending />}

      {history.isError && (
        <ResultsFailed error={history.error} onRetry={handleRetry} />
      )}

      {history.isSuccess && <ResultsLoaded results={results} />}
    </>
  );
}
