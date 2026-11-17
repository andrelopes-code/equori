import { Tag } from "@slotted/react/tag";
import { Text } from "@slotted/react/typography";
import type { ReactNode } from "react";

import type { components } from "@/api/schema.gen";
import styles from "@/features/cards/plastic-cards-tab/plastic-cards-tab.module.css";
import { formatBasisPoints } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { networkName } from "@/ui/card-face/network/network-name";

type Card = components["schemas"]["Card"];

interface PlasticCardDetailProps {
  card: Card;
  // The place of the card in the stack, from 1.
  position: number;
  count: number;
  toggle: ReactNode;
  actions: ReactNode;
}

// The selected card of the stack: its digits, its figures, its active switch and its actions.
export function PlasticCardDetail({
  card,
  position,
  count,
  toggle,
  actions,
}: PlasticCardDetailProps) {
  const t = useT();
  const [locale] = useAppLocale();

  return (
    <div className={styles.detail}>
      <div>
        <Text className={styles.eyebrow}>
          {t("card.selected", { n: position, count })}
        </Text>

        <Text size="xl" weight="semibold" className={styles.title}>
          {t("card.ending", { digits: card.last_four })}
        </Text>
      </div>

      <div className={styles.rows}>
        <div className={styles.row}>
          <Text size="sm" tone="muted" className={styles.holderLabel}>
            {t("accountForm.holder")}
          </Text>
          <Text weight="semibold" className={styles.holder}>
            {card.holder}
          </Text>
        </div>

        <div className={styles.row}>
          <Text size="sm" tone="muted" className={styles.label}>
            {t("card.type")}
          </Text>
          <Tag size="sm" tone="secondary">
            {card.virtual === true ? t("card.virtual") : t("card.physical")}
          </Tag>
        </div>

        <div className={styles.row}>
          <Text size="sm" tone="muted" className={styles.label}>
            {t("card.network")}
          </Text>
          <Text weight="semibold">{networkName(card.network, t)}</Text>
        </div>

        <div className={styles.row}>
          <Text size="sm" tone="muted" className={styles.label}>
            {t("card.foreignCharge")}
          </Text>
          <Text weight="semibold">
            {formatBasisPoints(card.foreign_charge_bp, locale)}
          </Text>
        </div>

        <div className={styles.row}>
          <Text size="sm" tone="muted" className={styles.label}>
            {t("card.active")}
          </Text>
          {toggle}
        </div>
      </div>

      <div className={styles.actions}>{actions}</div>
    </div>
  );
}
