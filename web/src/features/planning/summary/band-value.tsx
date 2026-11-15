import styles from "@/features/planning/summary/summary-band.module.css";
import { useMoneyFormat } from "@/privacy/use-money-format";
import type { MoneyAmount } from "@/ui/money/money-value";

interface BandValueProps {
  value: string | (MoneyAmount & { signed?: boolean });
  focal: boolean;
}

// A figure of the band: an amount draws its symbol and fraction at the unit step, the sign
// against the digits; text stands as written.
export function BandValue({ value, focal }: BandValueProps) {
  const fmt = useMoneyFormat();
  if (typeof value === "string")
    return (
      <span className={styles.value} data-focal={focal ? "" : undefined}>
        {value}
      </span>
    );

  const segments = fmt.summary(value.money, value.scale);
  const sign =
    segments.find((s) => s.kind === "sign")?.text ??
    (value.signed === true && value.money.amount > 0 && !fmt.hidden ? "+" : "");

  return (
    <span
      className={styles.value}
      data-focal={focal ? "" : undefined}
      data-band-value=""
    >
      {segments.map((s) => {
        if (s.kind === "sign") return null;
        if (s.kind === "integer") return sign + s.text;
        if (
          s.kind === "symbol" ||
          s.kind === "fraction" ||
          s.kind === "compact"
        )
          return (
            <span key={s.kind} className={styles.unit}>
              {s.text}
            </span>
          );
        return s.text;
      })}
    </span>
  );
}
