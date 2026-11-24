import type { RovingGridCellProps } from "@slotted/react/roving-focus";

import styles from "@/features/portfolio/contribution-plan/criteria/board/board.module.css";
import type { CellAnswer } from "@/features/portfolio/contribution-plan/criteria/model/cell-answer";
import {
  cellWord,
  nextAnswer,
} from "@/features/portfolio/contribution-plan/criteria/model/cell-label";
import { useT } from "@/i18n/i18n-provider";
import { cx } from "@/ui/cx";

interface AnswerCellProps {
  cell: CellAnswer;
  // The figure equori read, or whose answer it is; "" for none.
  note: string;
  label: string;
  focus: RovingGridCellProps;
  // The next answer of the investor: yes or no, and null for a blank one.
  onAnswer: (yes: boolean | null) => void;
}

// Families read: toggle (one line and no second figure), data-grid (a cell that holds a control,
// not a cell that is one). The answer of one asset to one criterion: a button of the investor, or
// the flat answer of equori.
export function AnswerCell({
  cell,
  note,
  label,
  focus,
  onAnswer,
}: AnswerCellProps) {
  const t = useT();

  const blank = cell.kind === "own" && cell.yes === null;
  const yes = cell.kind !== "pending" && cell.yes === true;
  const word = cellWord(t, cell, note);
  const content = (
    <>
      <span aria-hidden="true" className={cx(blank && styles.note)}>
        {word}
      </span>
      {note !== "" && !blank && (
        <span aria-hidden="true" className={styles.note}>
          {note}
        </span>
      )}
    </>
  );

  if (cell.kind !== "own") {
    return (
      <div role="gridcell" className={styles.cell}>
        <span
          {...focus}
          role="img"
          aria-label={label}
          title={label}
          data-yes={yes}
          className={styles.answer}
        >
          {content}
        </span>
      </div>
    );
  }

  return (
    <div role="gridcell" className={styles.cell}>
      <button
        {...focus}
        type="button"
        aria-pressed={blank ? "mixed" : yes}
        aria-label={label}
        title={label}
        data-yes={yes}
        className={cx(styles.answer, styles.own)}
        onClick={() => {
          onAnswer(nextAnswer(cell));
        }}
      >
        {content}
      </button>
    </div>
  );
}
