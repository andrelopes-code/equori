import type { components } from "@/api/schema.gen";
import styles from "@/features/assistant/proposal/bodies/bodies.module.css";
import { DiffRows } from "@/features/assistant/proposal/bodies/diff-rows";
import { goalMonthly } from "@/features/assistant/proposal/bodies/goal-monthly";
import {
  changeOf,
  changesWithout,
} from "@/features/assistant/proposal/preview-field";
import { useValueText } from "@/features/assistant/proposal/use-value-text";
import { useScale } from "@/features/setup";
import { formatDate, parseAmount } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";
import { useMoneyFormat } from "@/privacy/use-money-format";

type Preview = components["schemas"]["AssistantPreview"];

interface GoalBodyProps {
  preview: Preview;
}

// A new goal: the target by its date, and what each month to that date must put in.
export function GoalBody({ preview }: GoalBodyProps) {
  const t = useT();
  const [locale] = useAppLocale();
  const today = useToday();
  const valueText = useValueText();
  const fmt = useMoneyFormat();
  const scaleOf = useScale();

  const target = changeOf(preview, "target")?.after;
  const due = changeOf(preview, "due_on")?.after?.date;
  const rest = changesWithout(preview, ["target", "due_on"]);
  const scale =
    target?.currency === undefined ? 2 : (scaleOf?.(target.currency) ?? 2);
  // The tools write an amount as a decimal with a dot: the en reading parses it to minor units (O7).
  const minor =
    target?.amount === undefined
      ? null
      : parseAmount(target.amount, scale, "en");
  const plan =
    minor === null || due === undefined
      ? undefined
      : goalMonthly(minor, today, due);

  return (
    <div className={styles.body}>
      <div className={styles.eqLine}>
        <b>{valueText(target)}</b>
        {due !== undefined && (
          <span>
            {t("assistantView.write.until", { date: formatDate(due, locale) })}
          </span>
        )}
        {plan !== undefined &&
          plan.months > 0 &&
          target?.currency !== undefined && (
            <>
              <b>
                {t("assistantView.write.months_of", {
                  n: String(plan.months),
                  amount: fmt.money(
                    { amount: plan.monthly, currency: target.currency },
                    scale,
                  ),
                })}
              </b>
            </>
          )}
      </div>

      <DiffRows changes={rest} />
    </div>
  );
}
