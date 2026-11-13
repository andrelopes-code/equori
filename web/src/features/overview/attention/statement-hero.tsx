import { ButtonLink } from "@slotted/react/button";
import {
  ListItem,
  ListItemBody,
  ListItemContent,
} from "@slotted/react/list-item";
import { Text } from "@slotted/react/typography";

import type { StatementItem } from "@/features/overview/attention/attention";
import { itemDestination } from "@/features/overview/attention/attention-destination";
import styles from "@/features/overview/attention/attention.module.css";
import { useBase } from "@/features/overview/model/use-base";
import { formatDate } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { MoneyFigure } from "@/ui/money/money-figure";
import { routeTo } from "@/ui/navigation/route-to";
import { useServed } from "@/ui/navigation/use-served";

// The statement past its due date, the one item of the list drawn as a block of its own: the
// amount to pay at 3xl, the days late written, and a ruler with a cell per late day (at most 7).
export function StatementHero({ item }: { item: StatementItem }) {
  const t = useT();
  const [locale] = useAppLocale();
  const { scale } = useBase();
  const served = useServed();
  const to = itemDestination(item, "");
  const { unpaid, due_date } = item.statement;
  const late =
    item.days === 1
      ? t("overview.attention.lateDaysOne")
      : t("overview.attention.lateDays", { count: item.days });

  return (
    <ListItem>
      <ListItemContent>
        <ListItemBody>
          <div className={styles.hero}>
            <div className={styles.top}>
              <Text size="sm" weight="medium" className={styles.name}>
                {t("overview.attention.statementOf", {
                  account: item.account.name,
                })}
              </Text>

              <Text size="sm" weight="semibold" tone="danger">
                {late}
              </Text>
            </div>

            <div className={styles.middle}>
              <span className={styles.amount}>
                <MoneyFigure
                  amount={unpaid.amount}
                  currency={unpaid.currency}
                  scale={scale === null ? 0 : scale(unpaid.currency)}
                />
              </span>

              {to !== undefined && served(to) && (
                <ButtonLink tone="danger" render={routeTo(to)}>
                  {t("overview.attention.pay")}
                </ButtonLink>
              )}
            </div>

            <div className={styles.days}>
              <span role="img" aria-label={late} className={styles.ruler}>
                {Array.from({ length: Math.min(item.days, 7) }, (_, i) => (
                  <span key={i} className={styles.day} />
                ))}
              </span>

              <Text size="sm" tone="muted" className={styles.since}>
                {t("overview.attention.lateSince", {
                  date: formatDate(due_date, locale),
                })}
              </Text>
            </div>
          </div>
        </ListItemBody>
      </ListItemContent>
    </ListItem>
  );
}
