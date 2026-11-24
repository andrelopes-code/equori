import { useAppLocale } from "@/i18n/i18n-provider";
import { Toned } from "@/ui/money/toned";
import { emptyCell, monthCellText } from "@/ui/month-heat/month-cell-text";
import styles from "@/ui/month-heat/month-heat.module.css";

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
