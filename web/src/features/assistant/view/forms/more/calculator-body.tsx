import { catalogKey } from "@/features/assistant/model/catalog-key";
import type { CalculatorData } from "@/features/assistant/view/forms/more/more-data";
import styles from "@/features/assistant/view/forms/forms.module.css";
import { useValueFormat } from "@/features/assistant/view/use-value-format";
import { valueText } from "@/features/assistant/view/value-text";
import type { FormBodyProps } from "@/features/assistant/view/view-forms";
import { useT } from "@/i18n/i18n-provider";

const DECIMAL = /^-?\d+(\.\d+)?$/;

// The inputs the calculator opens with, named as its fields; the calculator computes on its screen.
export function CalculatorBody({ data }: FormBodyProps) {
  const t = useT();
  const format = useValueFormat();
  const { inputs } = data as CalculatorData;

  const name = (key: string) => {
    const k = catalogKey(`assistantView.calcInput.${key}`);
    return k === undefined ? key : t(k);
  };
  const value = (v: string) =>
    DECIMAL.test(v) ? valueText({ decimal: v }, format) : v;

  return (
    <div className={styles.inputs}>
      {inputs.map((i) => (
        <span key={i.key} className={styles.inp}>
          <small>{name(i.key)}</small>
          {value(i.value)}
        </span>
      ))}
    </div>
  );
}
