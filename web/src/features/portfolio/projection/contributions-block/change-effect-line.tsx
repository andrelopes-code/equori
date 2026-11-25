import styles from "@/features/portfolio/projection/contributions-block/contributions-block.module.css";
import type { ChangeEffect } from "@/features/portfolio/projection/contributions-block/change-effect";
import { useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";

interface ChangeEffectLineProps {
  effect: ChangeEffect;
  age: number;
  currency: string;
  scale: number;
}

// PX9, PX11: the value at the withdrawal age with the change, and the difference against the plan
// without it in the success or danger tone with its sign written.
export function ChangeEffectLine({
  effect,
  age,
  currency,
  scale,
}: ChangeEffectLineProps) {
  const t = useT();
  const fmt = useMoneyFormat();

  const whole = (minor: number) => ({
    amount: Math.round(minor / 10 ** scale),
    currency,
  });

  return (
    <p className={styles.stepEffect}>
      {t("portfolio.projection.contributions.effect.lead", {
        value: fmt.money(whole(effect.value), 0),
        age,
      })}{" "}
      <span className={toneClass(effect.difference)}>
        {fmt.signed(whole(effect.difference), 0)}
      </span>{" "}
      {t("portfolio.projection.contributions.effect.tail")}
    </p>
  );
}

function toneClass(difference: number): string | undefined {
  if (difference > 0) return styles.gain;
  if (difference < 0) return styles.loss;

  return undefined;
}
