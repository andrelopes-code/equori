import type { PlanFields } from "@/features/portfolio/projection/model/plan-fields";
import { AgeFact } from "@/features/portfolio/projection/plan-section/age-fact";
import { BirthField } from "@/features/portfolio/projection/plan-section/birth-field";
import { LifeField } from "@/features/portfolio/projection/plan-section/life-field";
import { LifeHead } from "@/features/portfolio/projection/plan-section/life-head";
import styles from "@/features/portfolio/projection/plan-section/plan.module.css";
import { planSpans } from "@/features/portfolio/projection/plan-section/plan-spans";
import { UnitInput } from "@/features/portfolio/projection/plan-section/unit-input";
import { WithdrawalFields } from "@/features/portfolio/projection/plan-section/withdrawal-fields";
import type { TFunction } from "@/i18n/i18n-provider";
import { useT } from "@/i18n/i18n-provider";
import { cx } from "@/ui/cx";

interface LifeLineProps {
  fields: PlanFields;
  onChange: (patch: Partial<PlanFields>) => void;
  // Null while the user has no birth date: the first stop asks for it.
  age: number | null;
  currency: string;
  otherIncomes: boolean;
  // PX19: the withdrawals of the typed plan run already.
  started: boolean;
  // The texts of the ranges the typed ages and rate left, and of a last age that leaves no month.
  errors: {
    withdrawalAge: string | undefined;
    lastAge: string | undefined;
    rate: string | undefined;
  };
}

// PX17: the goal of the plan as the line of the member's life: today, the start and the end of
// the withdrawals, with the years between them.
export function LifeLine({
  fields,
  onChange,
  age,
  currency,
  otherIncomes,
  started,
  errors,
}: LifeLineProps) {
  const t = useT();

  const spans = planSpans(age, fields.withdrawalAge, fields.lastAge);
  const before = spans === null ? undefined : beforeText(t, spans);
  const after =
    spans === null
      ? undefined
      : yearsText(t, spans.after, "spanAfterOne", "spanAfter");

  return (
    <div className={cx(styles.life, age === null && styles.lifeAsk)}>
      <div className={styles.lifeStop}>
        <LifeHead line="before" text={before} />
        {age === null ? <BirthField /> : <AgeFact age={age} />}
      </div>

      <div className={styles.lifeStop}>
        <LifeHead line="after" text={after} />

        <div className={styles.lifeControls}>
          <LifeField
            label={t("portfolio.projection.plan.withdrawalAge")}
            note={startNote(t, spans, started)}
            error={errors.withdrawalAge}
          >
            <UnitInput
              unit={t("portfolio.projection.plan.years")}
              inputMode="numeric"
              value={fields.withdrawalAge}
              onChange={(withdrawalAge) => {
                onChange({ withdrawalAge });
              }}
            />
          </LifeField>

          <WithdrawalFields
            fields={fields}
            currency={currency}
            rateError={errors.rate}
            otherIncomes={otherIncomes}
            onChange={onChange}
          />
        </div>
      </div>

      <div className={styles.lifeStop}>
        <LifeHead line={null} />

        <LifeField
          label={t("portfolio.projection.plan.lastAge")}
          note={t("portfolio.projection.plan.lastAgeHint")}
          error={errors.lastAge}
        >
          <UnitInput
            unit={t("portfolio.projection.plan.years")}
            inputMode="numeric"
            value={fields.lastAge}
            onChange={(lastAge) => {
              onChange({ lastAge });
            }}
          />
        </LifeField>
      </div>
    </div>
  );
}

function beforeText(
  t: TFunction,
  spans: NonNullable<ReturnType<typeof planSpans>>,
) {
  if (spans.started) return t("portfolio.projection.plan.spanStarted");

  return yearsText(t, spans.before, "spanBeforeOne", "spanBefore");
}

// PX19: a plan whose withdrawals started says so under the age it typed.
function startNote(
  t: TFunction,
  spans: ReturnType<typeof planSpans>,
  started: boolean,
) {
  if (started) return t("portfolio.projection.plan.started");
  if (spans === null || spans.started)
    return t("portfolio.projection.plan.withdrawalAgeHint");

  return yearsText(t, spans.before, "yearAhead", "yearsAhead");
}

function yearsText(
  t: TFunction,
  years: number,
  one: "spanBeforeOne" | "spanAfterOne" | "yearAhead",
  many: "spanBefore" | "spanAfter" | "yearsAhead",
) {
  if (years === 1) return t(`portfolio.projection.plan.${one}`);

  return t(`portfolio.projection.plan.${many}`, { years: String(years) });
}
