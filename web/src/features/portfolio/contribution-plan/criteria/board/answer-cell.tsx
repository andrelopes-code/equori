import styles from "@/features/portfolio/contribution-plan/criteria/board/board.module.css";
import type { BoardFocus } from "@/features/portfolio/contribution-plan/criteria/board/use-board-focus";
import type { CellAnswer } from "@/features/portfolio/contribution-plan/criteria/model/cell-answer";
import { useT } from "@/i18n/i18n-provider";
import { cx } from "@/ui/cx";

interface AnswerCellProps {
  cell: CellAnswer;
  // The figure equori read, or whose answer it is; "" for none.
  note: string;
  label: string;
  focus: ReturnType<BoardFocus["cellProps"]>;
  onAnswer: (yes: boolean) => void;
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

  const yes = cell.kind !== "pending" && cell.yes;
  const answer = t(
    yes ? "contributionPlan.criteria.yes" : "contributionPlan.criteria.no",
  );
  const word =
    cell.kind === "pending" ? t("contributionPlan.criteria.waiting") : answer;
  const content = (
    <>
      <span aria-hidden="true">{word}</span>
      {note !== "" && (
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
        aria-pressed={yes}
        aria-label={label}
        title={label}
        data-yes={yes}
        className={cx(styles.answer, styles.own)}
        onClick={() => {
          onAnswer(!yes);
        }}
      >
        {content}
      </button>
    </div>
  );
}
