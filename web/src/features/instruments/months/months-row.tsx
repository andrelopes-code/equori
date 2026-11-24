import { priceAmount } from "@/features/instruments/model/price-stats";
import type { YearChanges } from "@/features/instruments/months/month-changes";
import styles from "@/features/instruments/months/months.module.css";
import { useAppLocale } from "@/i18n/i18n-provider";
import { MASK } from "@/privacy/mask";
import { useMoneyFormat } from "@/privacy/use-money-format";
import { Toned } from "@/ui/money/toned";
import type { HeatSteps } from "@/ui/month-heat/heat-level";
import { emptyCell, monthCellText } from "@/ui/month-heat/month-cell-text";
import { MonthCells } from "@/ui/month-heat/month-cells";
import heat from "@/ui/month-heat/month-heat.module.css";

interface MonthsRowProps {
  row: YearChanges;
  // The decimals of the column of prices.
  digits: number;
}

// IM6: a price moves more than a portfolio, so its steps are wider.
const steps: HeatSteps = [0.02, 0.05, 0.1];

// IM2: one calendar year.
export function MonthsRow({ row, digits }: MonthsRowProps) {
  const [locale] = useAppLocale();
  const fmt = useMoneyFormat();

  const cells = row.cells.map((bp) => (bp === null ? null : bp / 10000));
  const amount = priceAmount(row.end.value, digits);

  function changeText(fraction: number) {
    return fmt.hidden ? MASK : monthCellText(fraction, locale);
  }

  return (
    <tr>
      <th scope="row" className={heat.yearCol}>
        {row.year}
      </th>

      <MonthCells cells={cells} text={changeText} steps={steps} />

      <td className={styles.sumCol}>
        {row.changeBp === null && emptyCell}

        {row.changeBp !== null && (
          <strong>
            <Toned value={row.changeBp}>
              {changeText(row.changeBp / 10000)}
            </Toned>
          </strong>
        )}
      </td>

      <td className={styles.priceCol}>
        {fmt.number({ amount, currency: row.end.quote_instrument }, digits)}
      </td>
    </tr>
  );
}
