import { TxRow } from "@/features/assistant/view/forms/tx-row";
import type { TxsData } from "@/features/assistant/view/forms/view-data";
import styles from "@/features/assistant/view/forms/forms.module.css";
import type { FormBodyProps } from "@/features/assistant/view/view-forms";

// A list of transactions, newest first; the screen link of the foot opens the rest.
export function TxsBody({ data }: FormBodyProps) {
  const { items } = data as TxsData;

  return (
    <ul className={styles.events}>
      {items.map((item) => (
        <TxRow key={item.id} item={item} />
      ))}
    </ul>
  );
}
