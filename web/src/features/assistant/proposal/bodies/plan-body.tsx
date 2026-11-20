import type { components } from "@/api/schema.gen";
import styles from "@/features/assistant/proposal/bodies/bodies.module.css";
import { DiffRows } from "@/features/assistant/proposal/bodies/diff-rows";
import {
  changeOf,
  changesWithout,
} from "@/features/assistant/proposal/preview-field";
import { useValueText } from "@/features/assistant/proposal/use-value-text";
import { formatDate, formatReferenceMonth } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";

type Preview = components["schemas"]["AssistantPreview"];

interface PlanBodyProps {
  preview: Preview;
  // budget: an amount each month from a month; application: an amount from an account on a date.
  kind: "budget" | "application";
}

// A plan written in one line, the amount first: a budget's monthly limit from its month, or a fixed
// income application with the account it leaves and its date.
export function PlanBody({ preview, kind }: PlanBodyProps) {
  const t = useT();
  const [locale] = useAppLocale();
  const valueText = useValueText();

  const amount = valueText(changeOf(preview, "amount")?.after);
  const date = changeOf(preview, "date")?.after?.date;
  const account = valueText(changeOf(preview, "account")?.after);
  const rest = changesWithout(preview, ["amount", "date", "account"]);

  return (
    <div className={styles.body}>
      <div className={styles.eqLine}>
        <b>{amount}</b>
        {kind === "budget" && date !== undefined && (
          <span>
            {t("assistantView.write.per_month_from", {
              month: formatReferenceMonth(date.slice(0, 7), locale),
            })}
          </span>
        )}
        {kind === "application" && account !== undefined && (
          <span>{t("assistantView.write.from_account", { account })}</span>
        )}
        {kind === "application" && date !== undefined && (
          <span>
            {t("assistantView.write.on_date", {
              date: formatDate(date, locale),
            })}
          </span>
        )}
      </div>

      <DiffRows changes={rest} />
    </div>
  );
}
