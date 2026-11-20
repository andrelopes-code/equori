import { TxRow } from "@/features/assistant/view/forms/ledger/tx-row";
import type { AgendaData } from "@/features/assistant/view/forms/planning/planning-data";
import styles from "@/features/assistant/view/forms/forms.module.css";
import { useValueFormat } from "@/features/assistant/view/use-value-format";
import { formatDate } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";

interface AgendaWeekProps {
  week: AgendaData["weeks"][number];
}

// A week of commitments: its head with the total, then each occurrence on its day.
export function AgendaWeek({ week }: AgendaWeekProps) {
  const t = useT();
  const [locale] = useAppLocale();
  const format = useValueFormat();

  return (
    <>
      <li className={styles.week}>
        <span>
          {t("assistantView.agenda.week", {
            date: formatDate(week.start, locale),
          })}
        </span>
        <span>
          {format.money({ ...week.total, amount: Math.abs(week.total.amount) })}
        </span>
      </li>
      {week.events.map((e, i) => (
        <TxRow
          key={`${e.date}-${String(i)}`}
          item={{
            id: `${e.date}-${String(i)}`,
            date: e.date,
            name: e.description,
            account: e.account ?? "",
            category: "",
            amount: e.amount,
          }}
        />
      ))}
    </>
  );
}
