import { EvolutionPending } from "@/features/portfolio/results/states/evolution-pending";
import { MonthsPending } from "@/features/portfolio/results/states/months-pending";
import { ReturnPending } from "@/features/portfolio/results/states/return-pending";
import { WindowsPending } from "@/features/portfolio/results/states/windows-pending";

// PR11: the four blocks while the history is pending.
export function ResultsPending() {
  return (
    <>
      <ReturnPending />

      <WindowsPending />

      <MonthsPending />

      <EvolutionPending />
    </>
  );
}
