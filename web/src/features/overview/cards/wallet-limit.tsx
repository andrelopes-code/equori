import { Text } from "@slotted/react/typography";

import type { WalletLimit as Limit } from "@/features/overview/cards/wallet";
import styles from "@/features/overview/cards/wallet.module.css";
import { numberFormatter } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";
import { MoneyFigure } from "@/ui/money/money-figure";

const dash = "—";
const fullPercent = 100;

interface WalletLimitProps {
  // Undefined when the card holds no limit data.
  limit: Limit | undefined;
  scale: (currency: string) => number;
}

// The free limit of a card and the share in use over a meter (CW9).
export function WalletLimit({ limit, scale }: WalletLimitProps) {
  const t = useT();
  const [locale] = useAppLocale();
  const fmt = useMoneyFormat();

  if (limit === undefined) {
    return (
      <div className={styles.fact}>
        <dt>
          <Text size="sm" tone="muted">
            {t("overview.cards.limit")}
          </Text>
        </dt>
        <dd className={styles.factNote}>
          <Text size="sm" tone="muted">
            {t("overview.cards.noLimit")}
          </Text>
        </dd>
        <dd className={styles.factValue}>
          <Text tone="muted">{dash}</Text>
        </dd>
      </div>
    );
  }

  const digits = scale(limit.total.currency);
  const percent = numberFormatter(locale, { style: "percent" }).format(
    limit.percent / fullPercent,
  );
  const fill = `${String(Math.min(limit.percent, fullPercent))}%`;

  return (
    <div
      className={styles.fact}
      data-limit=""
      data-full={limit.full ? "" : undefined}
    >
      <dt>
        <Text size="sm" tone="muted">
          {t("overview.cards.limit")}
        </Text>
      </dt>
      <dd className={styles.factNote}>
        {limit.full && (
          <Text size="sm" tone="danger" weight="medium" numeric="tabular">
            {t("overview.cards.full")}
          </Text>
        )}

        {!limit.full && (
          <Text size="sm" tone="muted" numeric="tabular">
            {t("overview.cards.used", { percent })}
          </Text>
        )}
      </dd>
      <dd className={styles.factValue}>
        <Text numeric="tabular">
          <MoneyFigure
            amount={limit.available.amount}
            currency={limit.available.currency}
            scale={digits}
          />
        </Text>
      </dd>
      <dd
        className={styles.track}
        role="img"
        aria-label={t("overview.cards.limitLabel", {
          percent,
          used: fmt.money(limit.used, digits),
          limit: fmt.money(limit.total, digits),
        })}
      >
        <span className={styles.fill} style={{ inlineSize: fill }} />
      </dd>
    </div>
  );
}
