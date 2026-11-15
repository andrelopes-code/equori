import { Text } from "@slotted/react/typography";

import type { components } from "@/api/schema.gen";
import styles from "@/features/assistant/proposal/bodies.module.css";
import { PaymentNode } from "@/features/assistant/proposal/payment-node";
import {
  changeOf,
  changesWithout,
} from "@/features/assistant/proposal/preview-field";
import { ProposalChanges } from "@/features/assistant/proposal/proposal-changes";
import { useValueText } from "@/features/assistant/proposal/use-value-text";
import { formatReferenceMonth } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";

type Preview = components["schemas"]["AssistantPreview"];

interface PaymentBodyProps {
  preview: Preview;
}

// Families read: typography. The account the money leaves, the amount and the statement it
// pays.
export function PaymentBody({ preview }: PaymentBodyProps) {
  const t = useT();
  const [locale] = useAppLocale();
  const valueText = useValueText();
  const month = changeOf(preview, "statement")?.after?.text;
  const statement =
    month === undefined ? undefined : formatReferenceMonth(month, locale);
  const amount = valueText(changeOf(preview, "amount")?.after);
  const account = valueText(changeOf(preview, "account")?.after);
  const rest = changesWithout(preview, ["statement", "amount", "account"]);

  return (
    <div className={styles.body}>
      <div className={styles.pay}>
        <PaymentNode icon="wallet" text={account} />

        <span className={styles.mid}>
          <Text size="sm" weight="semibold" className={styles.amount}>
            {amount}
          </Text>
          <span className={styles.flow} aria-hidden="true" />
        </span>

        <PaymentNode
          icon="card"
          text={t("assistant.field.statement")}
          caption={statement}
        />
      </div>

      <ProposalChanges changes={rest} />
    </div>
  );
}
