import { useJourneyMoney } from "@/features/portfolio/projection/journey-block/use-journey-money";
import type { YearRow as YearRowData } from "@/features/portfolio/projection/model/year-rows";
import styles from "@/features/portfolio/projection/years-block/years-block.module.css";
import { formatYear, numberFormatter } from "@/i18n/format";
import { useAppLocale } from "@/i18n/i18n-provider";

const none = "–";

interface YearRowProps {
  row: YearRowData;
  currency: string;
  scale: number;
}

// PX10: one calendar year; a sum of zero is written as a dash.
export function YearRow({ row, currency, scale }: YearRowProps) {
  const [tag] = useAppLocale();
  const money = useJourneyMoney(currency, scale);

  const amount = (minor: number) => (minor === 0 ? none : money.exact(minor));
  const tone = row.gains < 0 ? styles.loss : styles.gain;

  return (
    <tr>
      <th scope="row" className={styles.yearCol}>
        {formatYear(`${String(row.year)}-01-01`, tag)}
      </th>

      <td className={styles.ageCol}>{numberFormatter(tag).format(row.age)}</td>

      <td>{amount(row.contributions)}</td>

      <td>
        <span className={tone}>{money.signed(row.gains)}</span>
      </td>

      <td>{amount(row.withdrawals)}</td>

      <td>{money.exact(row.contributed)}</td>

      <td>
        <strong>{money.exact(row.value)}</strong>
      </td>
    </tr>
  );
}
