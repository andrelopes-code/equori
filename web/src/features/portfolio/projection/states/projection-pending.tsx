import { Field, FieldLabel } from "@slotted/react/field";
import {
  Section,
  SectionBody,
  SectionHeader,
  SectionHeading,
  SectionTitle,
} from "@slotted/react/section";

import styles from "@/features/portfolio/projection/plan-section/plan.module.css";
import { PendingValue } from "@/features/portfolio/results/states/pending-value";
import type { MessageKey } from "@/i18n/catalog.en";
import { useT } from "@/i18n/i18n-provider";

const labels: readonly MessageKey[] = [
  "portfolio.projection.plan.age",
  "portfolio.projection.plan.withdrawalAge",
  "portfolio.projection.plan.withdrawal",
  "portfolio.projection.plan.income",
  "portfolio.projection.plan.lastAge",
];

const premiseLabels: readonly MessageKey[] = [
  "portfolio.projection.plan.realReturn",
  "portfolio.projection.plan.cautious",
  "portfolio.projection.plan.favorable",
  "portfolio.projection.plan.withdrawalReturn",
  "portfolio.projection.plan.inflation",
  "portfolio.projection.plan.gainTax",
];

// PX11: the plan section while its reads are pending; every static text stays, values wait.
export function ProjectionPending() {
  const t = useT();

  return (
    <Section
      size="lg"
      ground="surface"
      heading="title"
      aria-label={t("portfolio.projection.plan.title")}
      aria-busy="true"
    >
      <SectionHeader>
        <SectionTitle>
          <SectionHeading>
            {t("portfolio.projection.plan.title")}
          </SectionHeading>
        </SectionTitle>
      </SectionHeader>

      <SectionBody>
        <div className={styles.planRows}>
          {[labels, premiseLabels].map((row) => (
            <div key={row[0]} className={styles.planStrip}>
              {row.map((label) => (
                <Field key={label} necessity="none" className={styles.planFact}>
                  <FieldLabel>{t(label)}</FieldLabel>

                  <span className={styles.planFactValue}>
                    <PendingValue ch={8} />
                  </span>
                </Field>
              ))}
            </div>
          ))}
        </div>
      </SectionBody>
    </Section>
  );
}
