import type { ViewUnit } from "@/features/assistant/view/view-forms";
import styles from "@/features/assistant/view/forms/forms.module.css";
import { useValueFormat } from "@/features/assistant/view/use-value-format";
import { valueText } from "@/features/assistant/view/value-text";
import type { ViewMoney } from "@/features/assistant/view/view-types";

interface RowValueProps {
  amount: ViewMoney;
  shareBp: number;
  unit: ViewUnit;
}

// The value at a row's end: the chosen unit leads, the other follows in small muted text.
export function RowValue({ amount, shareBp, unit }: RowValueProps) {
  const format = useValueFormat();

  const money = valueText({ money: amount }, format);
  const share = valueText({ bp: shareBp }, format);
  const [lead, after] = unit === "share" ? [share, money] : [money, share];

  return (
    <span className={styles.rowValue}>
      {lead}
      <small>{after}</small>
    </span>
  );
}
