import { Text } from "@slotted/react/typography";

import type { AppearanceSummary } from "@/features/cards/card-appearance/appearance-summary";
import styles from "@/features/cards/card-appearance/card-appearance.module.css";
import { useT } from "@/i18n/i18n-provider";
import { CardFace } from "@/ui/card-face/card-face";
import type { CardFaceProps } from "@/ui/card-face/card-face";

interface CardAppearanceSummaryProps {
  face: CardFaceProps;
  summary: AppearanceSummary;
}

// The closed section: the card as it is drawn today beside its colour, art and chip.
export function CardAppearanceSummary({
  face,
  summary,
}: CardAppearanceSummaryProps) {
  const t = useT();

  return (
    <div className={styles.summary}>
      <div className={styles.face}>
        <CardFace {...face} />
      </div>

      <dl className={styles.facts}>
        <div className={styles.fact}>
          <dt>
            <Text size="xs" tone="muted">
              {t("cardFace.studio.color")}
            </Text>
          </dt>
          <dd>
            <Text size="md" weight="semibold" wrap="nowrap">
              {t(summary.color)}
            </Text>{" "}
            <Text size="xs" tone="muted" className={styles.hex}>
              {summary.hex}
            </Text>
          </dd>
        </div>

        <div className={styles.fact}>
          <dt>
            <Text size="xs" tone="muted">
              {t("cardFace.studio.art")}
            </Text>
          </dt>
          <dd>
            <Text size="md" weight="semibold" wrap="nowrap">
              {t(summary.art)}
            </Text>
          </dd>
        </div>

        <div className={styles.fact}>
          <dt>
            <Text size="xs" tone="muted">
              {t("cardFace.studio.chip")}
            </Text>
          </dt>
          <dd>
            <Text size="md" weight="semibold" wrap="nowrap">
              {t(summary.chip)}
            </Text>
          </dd>
        </div>
      </dl>
    </div>
  );
}
