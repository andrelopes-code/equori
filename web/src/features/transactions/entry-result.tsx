import { Stack } from "@slotted/react/stack";
import { Text } from "@slotted/react/typography";
import { useContext } from "react";
import { createPortal } from "react-dom";

import { ResultSlotContext } from "@/features/transactions/result-slot";
import styles from "@/features/transactions/foreign-form.module.css";

export interface ResultFigure {
  label: string;
  // Text as written; undefined while the inputs do not give the figure.
  value: string | undefined;
}

const emptyMark = "—";

// The live result of an entry that the server computes: one short row of figures, each a small
// label over its value. It is drawn in the page footer when the page offers a slot there, so it
// stays above the actions while the fields scroll; the row stays low so the fields keep the screen.
export function EntryResult({
  label,
  figures,
}: {
  label: string;
  figures: readonly ResultFigure[];
}) {
  const slot = useContext(ResultSlotContext);
  const content = (
    <section aria-label={label} className={styles.figures}>
      {figures.map((figure) => (
        <Stack key={figure.label} gap={0}>
          <Text size="xs" tone="muted">
            {figure.label}
          </Text>
          <Text size="sm" weight="semibold">
            {figure.value ?? emptyMark}
          </Text>
        </Stack>
      ))}
    </section>
  );
  return slot === null ? content : createPortal(content, slot);
}
