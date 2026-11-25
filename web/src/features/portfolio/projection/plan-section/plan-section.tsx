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

import { fieldRanges } from "@/features/portfolio/projection/model/plan-fields";
import type { PlanFields } from "@/features/portfolio/projection/model/plan-fields";
import { AgeFact } from "@/features/portfolio/projection/plan-section/age-fact";
import { BirthField } from "@/features/portfolio/projection/plan-section/birth-field";
import styles from "@/features/portfolio/projection/plan-section/plan.module.css";
import { PremiseFields } from "@/features/portfolio/projection/plan-section/premise-fields";
import { ReferencesLine } from "@/features/portfolio/projection/plan-section/references-line";
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
  // PX19: the withdrawals of the typed plan run already; its last age leaves no month.
  started: boolean;
  ended: boolean;
  canSave: boolean;
  saving: boolean;
  error: unknown;
  onSave: () => void;
}

// PX2, PX3, PX17: the plan as a row of the goal and a row of the premises; every block below follows them as they are typed.
export function PlanSection({
  fields,
  onChange,
  age,
  annualReal,
  currency,
  started,
  ended,
  canSave,
  saving,
  error,
  onSave,
}: PlanSectionProps) {
  const t = useT();
  const [locale] = useAppLocale();

  const ranges = fieldRanges(fields);
  const plain = numberFormatter(locale);
  const range = (limits: [number, number] | undefined) =>
    limits &&
    t("portfolio.projection.plan.rangeError", {
      min: plain.format(limits[0]),
      max: plain.format(limits[1]),
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
            disabled={!canSave || ended || saving}
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

        <div className={styles.planRows}>
          <div className={styles.planStrip}>
            {age === null ? <BirthField /> : <AgeFact age={age} />}

            <UnitField
              label={t("portfolio.projection.plan.withdrawalAge")}
              unit={t("portfolio.projection.plan.years")}
              inputMode="numeric"
              value={fields.withdrawalAge}
              hint={
                started ? t("portfolio.projection.plan.started") : undefined
              }
              error={range(ranges.withdrawalAge)}
              onChange={(withdrawalAge) => {
                onChange({ withdrawalAge });
              }}
            />

            <WithdrawalFields
              fields={fields}
              currency={currency}
              rateError={range(ranges.rate)}
              onChange={onChange}
            />

            <UnitField
              label={t("portfolio.projection.plan.lastAge")}
              unit={t("portfolio.projection.plan.years")}
              inputMode="numeric"
              value={fields.lastAge}
              error={
                range(ranges.lastAge) ??
                (ended
                  ? t("portfolio.projection.plan.ageError", {
                      age: Math.max(age ?? 0, Number(fields.lastAge)),
                    })
                  : undefined)
              }
              onChange={(lastAge) => {
                onChange({ lastAge });
              }}
            />
          </div>

          <PremiseFields
            fields={fields}
            ranges={ranges}
            range={range}
            annualReal={annualReal}
            onChange={onChange}
          />

          <ReferencesLine currency={currency} />
        </div>
      </SectionBody>
    </Section>
  );
}
