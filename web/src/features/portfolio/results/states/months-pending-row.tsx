import { PendingValue } from "@/features/portfolio/results/states/pending-value";
import pending from "@/features/portfolio/results/states/pending.module.css";
import styles from "@/ui/month-heat/month-heat.module.css";

const months = Array.from({ length: 12 }, (_, month) => month);

// One year of the month table while it is pending: a slow cell for each month.
export function MonthsPendingRow() {
  return (
    <tr>
      <th scope="row" className={styles.yearCol}>
        <PendingValue ch={4} />
      </th>

      {months.map((month) => (
        <td key={month} className={pending.pendingCell} />
      ))}

      <td className={styles.sumCol}>
        <PendingValue ch={5} />
      </td>

      <td className={styles.sumCol}>
        <PendingValue ch={6} />
      </td>
    </tr>
  );
}
