import { FigureCard } from "@/ui/figure-card";
import { FigureGrid } from "@/ui/figure-grid";

export interface ResultFigure {
  label: string;
  // Text as written; undefined while the inputs do not give the figure.
  value: string | undefined;
}

interface EntryResultProps {
  label: string;
  figures: readonly ResultFigure[];
}

// The live result of an entry that the server computes, drawn in the form's aside
// (docs/contributing/forms.md, F8) with the figures of the other entry forms.
export function EntryResult({ label, figures }: EntryResultProps) {
  return (
    <FigureGrid label={label}>
      {figures.map((figure) => (
        <FigureCard
          key={figure.label}
          label={figure.label}
          value={figure.value}
          note={null}
        />
      ))}
    </FigureGrid>
  );
}
