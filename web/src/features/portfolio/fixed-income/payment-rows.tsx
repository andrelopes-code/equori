import {
  DescriptionList,
  DescriptionListDescription,
  DescriptionListItem,
  DescriptionListTerm,
} from "@slotted/react/description-list";
import { Link } from "@slotted/react/link";
import { Tag } from "@slotted/react/tag";
import { Text } from "@slotted/react/typography";

import type { components } from "@/api/schema.gen";
import { recordSearch } from "@/features/instruments";
import styles from "@/features/portfolio/fixed-income/payments-timeline.module.css";
import { formatDayMonthNumeric } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";
import { routeTo } from "@/ui/navigation/route-to";

type Event = components["schemas"]["FixedIncomeEvent"];

interface PaymentRowsProps {
  events: readonly Event[];
  names: ReadonlyMap<string, string>;
  scale: (code: string) => number;
}

export function PaymentRows({ events, names, scale }: PaymentRowsProps) {
  const t = useT();
  const fmt = useMoneyFormat();
  const [locale] = useAppLocale();

  return (
    <DescriptionList variant="ruled">
      {events.map((e) => {
        const label = `${t(`terms.event.${e.kind}` as "terms.event.interest")} · ${names.get(e.instrument) ?? e.instrument} · ${formatDayMonthNumeric(e.date, locale)}`;

        return (
          <DescriptionListItem
            key={`${e.instrument}${e.date}${e.kind}`}
            className={styles.row}
          >
            <DescriptionListTerm className={styles.label}>
              {e.state === "due" ? (
                <Link
                  render={routeTo({
                    to: "/transactions/new",
                    search: recordSearch(e, scale) as never,
                  })}
                >
                  {label}
                </Link>
              ) : (
                label
              )}
            </DescriptionListTerm>
            <DescriptionListDescription>
              <span className={styles.value}>
                {e.state === "due" && (
                  <Tag tone="danger" size="sm">
                    {t("fixedIncome.next.due")}
                  </Tag>
                )}
                {e.gross === undefined ? (
                  <Text tone="muted">{t("fixedIncome.next.rateMissing")}</Text>
                ) : (
                  fmt.money(e.gross, scale(e.gross.currency))
                )}
              </span>
            </DescriptionListDescription>
          </DescriptionListItem>
        );
      })}
    </DescriptionList>
  );
}
