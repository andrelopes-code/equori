import { Stack } from "@slotted/react/stack";
import { Text } from "@slotted/react/typography";
import { useContext } from "react";
import { createPortal } from "react-dom";

import { ResultSlotContext } from "@/features/transactions/result-slot";
import styles from "@/features/transactions/foreign-form.module.css";
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

// The live result of an entry that the server computes. It is drawn in the page footer when the
// page offers a slot there, so it stays above the actions while the fields scroll. Figures side by side from 600 px; below, one line per figure, so the result leaves the fields
// visible on a phone.
export function EntryResult({
  label,
  figures,
}: {
  label: string;
  figures: readonly ResultFigure[];
}) {
  const compact = useMediaQuery(compactQuery);
  const slot = useContext(ResultSlotContext);
  const content = (
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
        <section aria-label={label} className={styles.figures}>
          {figures.map((figure) => (
            <Stack key={figure.label} gap={0}>
              <Text size="sm" tone="muted">
                {figure.label}
              </Text>
              <Text size="lg" weight="semibold">
                {figure.value ?? emptyMark}
              </Text>
              {figure.note !== undefined && figure.note !== null && (
                <Text size="sm" tone="muted">
                  {figure.note}
                </Text>
              )}
            </Stack>
          ))}
        </section>
      )}
    </div>
  );
  return slot === null ? content : createPortal(content, slot);
}
