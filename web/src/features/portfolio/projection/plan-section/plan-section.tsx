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
import { LifeLine } from "@/features/portfolio/projection/plan-section/life-line";
import styles from "@/features/portfolio/projection/plan-section/plan.module.css";
import { PremiseGroups } from "@/features/portfolio/projection/plan-section/premise-groups";
import { errorText } from "@/api/problem";
import { formatDate, numberFormatter } from "@/i18n/format";
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
  // PX23: the day the plan was first saved; absent before the first save.
  since: string | undefined;
  // PX19: the withdrawals of the typed plan run already; its last age leaves no month.
  started: boolean;
  ended: boolean;
  otherIncomes: boolean;
  canSave: boolean;
  saving: boolean;
  error: unknown;
  onSave: () => void;
}

// PX2, PX3, PX17: the goal on the line of the member's life and the premises under it; every
// block below follows them as they are typed.
export function PlanSection({
  fields,
  onChange,
  age,
  annualReal,
  currency,
  since,
  started,
  ended,
  otherIncomes,
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
  const lastAgeError =
    range(ranges.lastAge) ??
    (ended
      ? t("portfolio.projection.plan.ageError", {
          age: Math.max(age ?? 0, Number(fields.lastAge)),
        })
      : undefined);

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
          {since !== undefined && (
            <span className={styles.planSaved}>
              {t("portfolio.projection.plan.since", {
                date: formatDate(since, locale),
              })}
            </span>
          )}

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
          <FormNotice className={styles.planNotice}>
            {errorText(error, t)}
          </FormNotice>
        )}

        <LifeLine
          fields={fields}
          onChange={onChange}
          age={age}
          currency={currency}
          otherIncomes={otherIncomes}
          started={started}
          errors={{
            withdrawalAge: range(ranges.withdrawalAge),
            lastAge: lastAgeError,
            rate: range(ranges.rate),
          }}
        />

        <PremiseGroups
          fields={fields}
          ranges={ranges}
          range={range}
          annualReal={annualReal}
          currency={currency}
          onChange={onChange}
        />
      </SectionBody>
    </Section>
  );
}
