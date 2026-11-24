import { Skeleton } from "@slotted/react/skeleton";

import styles from "@/features/instruments/months/months.module.css";
import heat from "@/ui/month-heat/month-heat.module.css";

const months = Array.from({ length: 12 }, (_, month) => month);

// One year of the table while its read is pending.
export function MonthsPendingRow() {
  return (
    <tr>
      <th scope="row" className={heat.yearCol}>
        <Skeleton shape="text" inlineSize="4ch" />
      </th>

      {months.map((month) => (
        <td key={month}>
          <Skeleton shape="text" inlineSize="4ch" />
        </td>
      ))}

      <td className={styles.sumCol}>
        <Skeleton shape="text" inlineSize="5ch" />
      </td>

      <td className={styles.priceCol}>
        <Skeleton shape="text" inlineSize="6ch" />
      </td>
    </tr>
  );
}
