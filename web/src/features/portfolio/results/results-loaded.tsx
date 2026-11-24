import { AttributionSection } from "@/features/portfolio/attribution/attribution-section";
import { EvolutionBlock } from "@/features/portfolio/results/evolution-block/evolution-block";
import { MonthsBlock } from "@/features/portfolio/results/months-block/months-block";
import { ReturnBlock } from "@/features/portfolio/results/return-block/return-block";
import { ResultsFailed } from "@/features/portfolio/results/states/results-failed";
import { ReturnPending } from "@/features/portfolio/results/states/return-pending";
import type { useResults } from "@/features/portfolio/results/use-results";
import { WindowsBlock } from "@/features/portfolio/results/windows-block/windows-block";

interface ResultsLoadedProps {
  // The history read has answered; the period read may still be pending or failed.
  results: ReturnType<typeof useResults>;
}

// PR3, PR11: the four blocks and "Rendimento por ativo"; a period read that fails draws the failure
// in the place of the return block only.
export function ResultsLoaded({ results }: ResultsLoadedProps) {
  const { history, period, report, whole } = results;

  function handleRetry() {
    void period.refetch();
  }

  return (
    <>
      {period.isPending && <ReturnPending />}

      {period.isError && (
        <ResultsFailed error={period.error} onRetry={handleRetry} />
      )}

      {period.isSuccess && (
        <ReturnBlock series={period.data} report={report.data} whole={whole} />
      )}

      <WindowsBlock history={history.data} />

      <MonthsBlock history={history.data} />

      <EvolutionBlock
        history={history.data}
        period={period.data}
        report={report.data}
        whole={whole}
      />

      <AttributionSection />
    </>
  );
}
