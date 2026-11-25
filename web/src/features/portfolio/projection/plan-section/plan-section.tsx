import { Button } from "@slotted/react/button";
import {
  Section,
  SectionActions,
  SectionBody,
  SectionDescription,
  SectionHeader,
  SectionHeading,
  SectionTitle,
} from "@slotted/react/section";

import type { PlanFields } from "@/features/portfolio/projection/model/plan-fields";
import { AgeFact } from "@/features/portfolio/projection/plan-section/age-fact";
import { BirthField } from "@/features/portfolio/projection/plan-section/birth-field";
import styles from "@/features/portfolio/projection/plan-section/plan.module.css";
import { UnitField } from "@/features/portfolio/projection/plan-section/unit-field";
import { WithdrawalFields } from "@/features/portfolio/projection/plan-section/withdrawal-fields";
import { errorText } from "@/api/problem";
import { numberFormatter } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { FormNotice } from "@/ui/form-layout/form-notice";

interface PlanSectionProps {
  fields: PlanFields;
  onChange: (patch: Partial<PlanFields>) => void;
  // Null while the user has no birth date: the section asks for it in place of the age.
  age: number | null;
  // The realized real return of the portfolio a year, a fraction; null under 12 months of history.
  annualReal: number | null;
  currency: string;
  tooEarly: boolean;
  canSave: boolean;
  saving: boolean;
  error: unknown;
  onSave: () => void;
}

// PX2, PX3: the plan as one row of fields; every block below follows them as they are typed.
export function PlanSection({
  fields,
  onChange,
  age,
  annualReal,
  currency,
  tooEarly,
  canSave,
  saving,
  error,
  onSave,
}: PlanSectionProps) {
  const t = useT();
  const [locale] = useAppLocale();

  const portfolioReturn =
    annualReal === null
      ? undefined
      : t("portfolio.projection.plan.portfolioReturn", {
          rate: numberFormatter(locale, {
            minimumFractionDigits: 1,
            maximumFractionDigits: 1,
          }).format(annualReal * 100),
        });

  return (
    <Section
      size="lg"
      ground="surface"
      heading="title"
      aria-label={t("portfolio.projection.plan.title")}
    >
      <SectionHeader>
        <SectionTitle>
          <SectionHeading>
            {t("portfolio.projection.plan.title")}
          </SectionHeading>
          <SectionDescription>
            {t("portfolio.projection.plan.description")}
          </SectionDescription>
        </SectionTitle>

        <SectionActions>
          <Button
            variant="outline"
            tone="secondary"
            disabled={!canSave || saving}
            onClick={onSave}
          >
            {t("portfolio.projection.plan.save")}
          </Button>
        </SectionActions>
      </SectionHeader>

      <SectionBody>
        {error !== null && error !== undefined && (
          <FormNotice>{errorText(error, t)}</FormNotice>
        )}

        <div className={styles.planStrip}>
          {age === null ? <BirthField /> : <AgeFact age={age} />}

          <UnitField
            label={t("portfolio.projection.plan.withdrawalAge")}
            unit={t("portfolio.projection.plan.years")}
            inputMode="numeric"
            value={fields.withdrawalAge}
            error={
              tooEarly ? t("portfolio.projection.plan.ageError") : undefined
            }
            onChange={(withdrawalAge) => {
              onChange({ withdrawalAge });
            }}
          />

          <UnitField
            label={t("portfolio.projection.plan.realReturn")}
            unit={t("portfolio.projection.plan.perYear")}
            inputMode="decimal"
            value={fields.realReturn}
            hint={portfolioReturn}
            onChange={(realReturn) => {
              onChange({ realReturn });
            }}
          />

          <UnitField
            label={t("portfolio.projection.plan.inflation")}
            unit={t("portfolio.projection.plan.perYear")}
            inputMode="decimal"
            value={fields.inflation}
            onChange={(inflation) => {
              onChange({ inflation });
            }}
          />

          <WithdrawalFields
            fields={fields}
            currency={currency}
            onChange={onChange}
          />

          <UnitField
            label={t("portfolio.projection.plan.lastAge")}
            unit={t("portfolio.projection.plan.years")}
            inputMode="numeric"
            value={fields.lastAge}
            onChange={(lastAge) => {
              onChange({ lastAge });
            }}
          />
        </div>
      </SectionBody>
    </Section>
  );
}
