import { potColor } from "@/features/planning/income-split/dialog/split-bar";
import styles from "@/features/planning/income-split/dialog/split-dialog.module.css";

interface MatrixCellProps {
  // The name of the radio group of the row.
  group: string;
  // The bucket of the column, or the words for no bucket.
  label: string;
  // The position of the bucket; undefined in the column without a bucket.
  number?: number;
  checked: boolean;
  // The row is a subcategory that follows its parent.
  follows: boolean;
  // The subcategories of the row that sit in this column.
  more: number;
  // The words for more, read after the label.
  moreLabel: string;
  onPick: () => void;
}

// One column of a category's row (dialog spec A250): a radio that fills the cell and, beside
// it, the mark of its state. Built here: RadioGroup draws its own indicator, and the mark of
// this matrix is the number of the bucket.
export function MatrixCell({
  group,
  label,
  number,
  checked,
  follows,
  more,
  moreLabel,
  onPick,
}: MatrixCellProps) {
  const none = number === undefined;
  const name = more > 0 ? `${label}, ${moreLabel}` : label;
  const moreText = `+${String(more)}`;

  return (
    <label
      className={styles.cell}
      data-none={none ? "" : undefined}
      data-more={more > 0 ? "" : undefined}
    >
      <input
        className={styles.pick}
        type="radio"
        name={group}
        aria-label={name}
        checked={checked}
        onChange={onPick}
      />
      <span
        className={styles.mark}
        data-color={none ? undefined : potColor(number)}
        data-none={none ? "" : undefined}
        data-inherited={checked && follows ? "" : undefined}
      >
        {none ? null : String(number)}
      </span>
      {more > 0 && (
        <span className={styles.more} aria-hidden="true">
          {moreText}
        </span>
      )}
    </label>
  );
}
