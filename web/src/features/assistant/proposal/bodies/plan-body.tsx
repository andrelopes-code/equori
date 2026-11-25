import type { components } from "@/api/schema.gen";
import styles from "@/features/assistant/proposal/bodies/bodies.module.css";
import { DiffRows } from "@/features/assistant/proposal/bodies/diff-rows";
import {
  changeOf,
  changesWithout,
} from "@/features/assistant/proposal/preview-field";
import { useValueText } from "@/features/assistant/proposal/use-value-text";
import { formatReferenceMonth } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";

type Preview = components["schemas"]["AssistantPreview"];

interface PlanBodyProps {
  preview: Preview;
}

// A budget's monthly limit from its month, in one line, the amount first.
export function PlanBody({ preview }: PlanBodyProps) {
  const t = useT();
  const [locale] = useAppLocale();
  const valueText = useValueText();

  const amount = valueText(changeOf(preview, "amount")?.after);
  const date = changeOf(preview, "date")?.after?.date;
  const rest = changesWithout(preview, ["amount", "date"]);

  return (
    <div className={styles.body}>
      <div className={styles.eqLine}>
        <b>{amount}</b>
        {date !== undefined && (
          <span>
            {t("assistantView.write.per_month_from", {
              month: formatReferenceMonth(date.slice(0, 7), locale),
            })}
          </span>
        )}
      </div>

      <DiffRows changes={rest} />
    </div>
  );
}
