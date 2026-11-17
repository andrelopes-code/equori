import { Text } from "@slotted/react/typography";

import type { components } from "@/api/schema.gen";
import styles from "@/features/assistant/proposal/bodies/bodies.module.css";
import {
  changeOf,
  changesWithout,
} from "@/features/assistant/proposal/preview-field";
import { ProposalChanges } from "@/features/assistant/proposal/proposal-changes";
import { useValueText } from "@/features/assistant/proposal/use-value-text";
import { useT } from "@/i18n/i18n-provider";
import { cx } from "@/ui/cx";

type Preview = components["schemas"]["AssistantPreview"];

interface InvestmentBodyProps {
  preview: Preview;
}

const TIMES = "×";
const EQUALS = "=";

// Families read: typography. Quantity times price equals total, then the paying account.
export function InvestmentBody({ preview }: InvestmentBodyProps) {
  const t = useT();
  const valueText = useValueText();
  const instrument = valueText(changeOf(preview, "instrument")?.after);
  const quantity = valueText(changeOf(preview, "quantity")?.after);
  const price = valueText(changeOf(preview, "price")?.after);
  const total = valueText(changeOf(preview, "amount")?.after);
  const account = valueText(changeOf(preview, "account")?.after);
  const rest = changesWithout(preview, [
    "instrument",
    "quantity",
    "price",
    "amount",
    "account",
  ]);

  return (
    <div className={styles.body}>
      <div className={styles.eq}>
        <span className={styles.eqCell}>
          <Text weight="semibold" className={styles.eqValue}>
            {quantity}
          </Text>
          <Text size="xs" tone="muted">
            {instrument}
          </Text>
        </span>

        <span className={styles.eqOp} aria-hidden="true">
          {TIMES}
        </span>

        <span className={styles.eqCell}>
          <Text weight="semibold" className={styles.eqValue}>
            {price}
          </Text>
          <Text size="xs" tone="muted">
            {t("assistant.body.price")}
          </Text>
        </span>

        {total !== undefined && (
          <>
            <span className={styles.eqOp} aria-hidden="true">
              {EQUALS}
            </span>

            <span className={cx(styles.eqCell, styles.eqTotal)}>
              <Text weight="semibold" className={styles.eqValue}>
                {total}
              </Text>
              <Text size="xs" tone="muted">
                {t("assistant.body.total")}
              </Text>
            </span>
          </>
        )}
      </div>

      {account !== undefined && (
        <Text size="sm" tone="muted">
          {t("assistant.body.paid_from", { account })}
        </Text>
      )}

      <ProposalChanges changes={rest} />
    </div>
  );
}
