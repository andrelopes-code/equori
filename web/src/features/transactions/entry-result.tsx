import { Stack } from "@slotted/react/stack";
import { Text } from "@slotted/react/typography";

import styles from "@/features/transactions/foreign-form.module.css";
import { FigureCard } from "@/ui/figure-card";
import { FigureGrid } from "@/ui/figure-grid";
import { compactQuery, useMediaQuery } from "@/ui/use-media-query";

export interface ResultFigure {
  label: string;
  // Text as written; undefined while the inputs do not give the figure.
  value: string | undefined;
  note?: string | null;
}

const emptyMark = "\u2014";

function lineOf(figure: ResultFigure): string {
  return `${figure.label}: ${figure.value ?? emptyMark}`;
}

// The live result of an entry that the server computes: stays above the footer while the fields
// scroll. Figure cards from 600 px; below, one line per figure, so the result leaves the fields
// visible on a phone.
export function EntryResult({
  label,
  figures,
}: {
  label: string;
  figures: readonly ResultFigure[];
}) {
  const compact = useMediaQuery(compactQuery);
  return (
    <div className={styles.result}>
      {compact ? (
        <Stack gap={1} role="region" aria-label={label}>
          {figures.map((figure) => (
            <Text key={figure.label} size="sm">
              {lineOf(figure)}
            </Text>
          ))}
        </Stack>
      ) : (
        <FigureGrid label={label}>
          {figures.map((figure) => (
            <FigureCard
              key={figure.label}
              label={figure.label}
              value={figure.value}
              note={figure.note ?? null}
            />
          ))}
        </FigureGrid>
      )}
    </div>
  );
}
