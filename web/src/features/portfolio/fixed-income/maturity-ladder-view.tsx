import {
  Section,
  SectionBody,
  SectionDescription,
  SectionHeader,
  SectionHeading,
  SectionTitle,
} from "@slotted/react/section";

import kinds from "@/features/portfolio/fixed-income/kind-fill.module.css";
import styles from "@/features/portfolio/fixed-income/maturity-ladder.module.css";
import type { LadderYear } from "@/features/portfolio/fixed-income/maturity-ladder";
import { useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";

interface MaturityLadderProps {
  years: readonly LadderYear[];
  currency: string;
  scale: number;
}

// Own element: no family draws a bar per year scaled to the largest (families read: chart, which
// draws axes and series, and progress-indicator, which states one task).
export function MaturityLadder({
  years,
  currency,
  scale,
}: MaturityLadderProps) {
  const t = useT();
  const fmt = useMoneyFormat();

  return (
    <Section size="sm">
      <SectionHeader>
        <SectionTitle>
          <SectionHeading>{t("fixedIncome.ladder")}</SectionHeading>
          <SectionDescription>
            {t("fixedIncome.ladder.description")}
          </SectionDescription>
        </SectionTitle>
      </SectionHeader>
      <SectionBody>
        <ol className={styles.ladder}>
          {years.map((y) => (
            <li key={y.year} className={styles.row}>
              <span>{y.year}</span>
              <span
                className={[styles.bar, kinds[y.kind]].join(" ")}
                style={{ inlineSize: `${String(y.width)}%` }}
                aria-hidden="true"
              />
              <span className={styles.value}>
                {fmt.money({ amount: y.value, currency }, scale)}
              </span>
            </li>
          ))}
        </ol>
      </SectionBody>
    </Section>
  );
}
