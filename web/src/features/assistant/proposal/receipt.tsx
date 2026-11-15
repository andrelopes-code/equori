import { Link } from "@slotted/react/link";
import { Text } from "@slotted/react/typography";

import type { components } from "@/api/schema.gen";
import { catalogKey } from "@/features/assistant/model/catalog-key";
import { AssistantIcon } from "@/features/assistant/panel/assistant-icon";
import { proposalScreen } from "@/features/assistant/proposal/proposal-screen";
import { receiptFields } from "@/features/assistant/proposal/receipt-fields";
import styles from "@/features/assistant/proposal/results.module.css";
import { useValueText } from "@/features/assistant/proposal/use-value-text";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { routeTo } from "@/ui/navigation/route-to";
import { useServed } from "@/ui/navigation/use-served";

type Proposal = components["schemas"]["AssistantProposal"];

interface ReceiptProps {
  proposal: Proposal;
}

// Families read: link, typography. An executed `record_transaction` as a receipt: the check that
// draws itself, the decision time, the amount first, then the record's fields (spec 2026-11-15,
// section 5).
export function Receipt({ proposal }: ReceiptProps) {
  const t = useT();
  const [locale] = useAppLocale();
  const served = useServed();
  const valueText = useValueText();

  const { amount, rows } = receiptFields(proposal.preview.changes);
  const screen = proposalScreen(proposal.tool, proposal.result);
  const opens = screen !== undefined && served({ href: screen });
  const decidedAt = proposal.decided_at;
  const decided =
    decidedAt === undefined
      ? undefined
      : new Intl.DateTimeFormat(locale, {
          dateStyle: "short",
          timeStyle: "short",
        }).format(new Date(decidedAt));

  return (
    <article className={styles.receipt}>
      <div className={styles.top}>
        <span className={styles.badge}>
          <svg
            className={styles.check}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.25}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            focusable="false"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="m8 12.5 3 3 5-6" />
          </svg>
        </span>

        <span className={styles.heading}>
          <Text size="sm" weight="semibold">
            {t("assistant.result.receipt")}
          </Text>
          {decided !== undefined && (
            <Text size="xs" tone="muted">
              <time dateTime={decidedAt}>{decided}</time>
            </Text>
          )}
        </span>

        {opens && (
          <Text size="sm" className={styles.open}>
            <Link render={routeTo({ href: screen })}>
              {t("assistant.proposal.open")}
              <span className={styles.icon14}>
                <AssistantIcon name="link" />
              </span>
            </Link>
          </Text>
        )}
      </div>

      <Text className={styles.amount} weight="semibold">
        {valueText(amount)}
      </Text>

      <div className={styles.rows}>
        {rows.map((change) => {
          const key = catalogKey(`assistant.field.${change.field}`);

          return (
            <div key={change.field} className={styles.row}>
              <Text size="sm" tone="muted">
                {key === undefined ? change.field : t(key)}
              </Text>
              <Text size="sm" weight="medium" className={styles.value}>
                {valueText(change.after)}
              </Text>
            </div>
          );
        })}
      </div>
    </article>
  );
}
