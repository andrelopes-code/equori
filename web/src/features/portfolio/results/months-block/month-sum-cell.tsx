import { Toned } from "@/features/portfolio/results/shared/toned";
import {
  emptyCell,
  monthCellText,
} from "@/features/portfolio/results/months-block/month-cell-text";
import styles from "@/features/portfolio/results/months-block/months-block.module.css";
import { useAppLocale } from "@/i18n/i18n-provider";

interface MonthSumCellProps {
  value: number | null;
  // The year total reads in bold; the accumulated value in the regular weight.
  strong?: boolean;
}

// PR8, PR10: the year total or the accumulated return of a row, in the tone of its sign.
export function MonthSumCell({ value, strong = false }: MonthSumCellProps) {
  const [tag] = useAppLocale();

  if (value === null) return <td className={styles.sumCol}>{emptyCell}</td>;

  const text = <Toned value={value}>{monthCellText(value, tag)}</Toned>;

  return (
    <td className={styles.sumCol}>{strong ? <strong>{text}</strong> : text}</td>
  );
}
