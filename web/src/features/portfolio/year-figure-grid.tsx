import { FigureCard } from "@/ui/figure-card";
import { FigureGrid } from "@/ui/figure-grid";

interface YearFigureGridProps {
  label: string;
  figures: readonly { label: string; value: string; note: string }[];
}

// The totals that open a tab of the year. Sums of different currencies stand side by side.
export function YearFigureGrid({ label, figures }: YearFigureGridProps) {
  return (
    <FigureGrid label={label}>
      {figures.map((figure) => (
        <FigureCard
          key={figure.label}
          label={figure.label}
          value={figure.value}
          note={figure.note}
          goodWhen="none"
        />
      ))}
    </FigureGrid>
  );
}
