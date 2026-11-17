import { Button } from "@slotted/react/button";
import { Text } from "@slotted/react/typography";

import type { components } from "@/api/schema.gen";
import styles from "@/features/accounts/connections/investment-movement-row.module.css";
import { useScale } from "@/features/setup";
import { formatDate } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import type { MessageKey } from "@/i18n/catalog.en";
import { useMoneyFormat } from "@/privacy/use-money-format";

type Movement = components["schemas"]["InvestmentMovement"];

const proposalWords: Record<string, MessageKey> = {
  application: "connection.investments.proposal.application",
  contribution: "connection.investments.proposal.contribution",
  sale: "connection.investments.proposal.sale",
  income: "connection.investments.proposal.income",
  tax_of_sale: "connection.investments.proposal.tax_of_sale",
  none: "connection.investments.proposal.none",
};

interface InvestmentMovementRowProps {
  movement: Movement;
  name: string;
  disabled: boolean;
  onConfirm: (movement: Movement) => void;
  onDismiss: (movement: Movement) => void;
  onUndo: (movement: Movement) => void;
}

// One movement read from the institution, in one line with its actions.
export function InvestmentMovementRow({
  movement,
  name,
  disabled,
  onConfirm,
  onDismiss,
  onUndo,
}: InvestmentMovementRowProps) {
  const t = useT();
  const [locale] = useAppLocale();
  const fmt = useMoneyFormat();
  const scale = useScale();

  const word = proposalWords[movement.proposal];
  const label = [
    formatDate(movement.date, locale),
    word === undefined ? movement.proposal : t(word),
    name,
  ].join(" · ");
  const { amount, currency } = movement.amount;
  const total = fmt.money(
    { amount: Math.abs(amount), currency },
    (scale ?? (() => 2))(currency),
  );
  const pending = movement.state === "pending";
  const stateWord =
    movement.state === "pending"
      ? null
      : t(`connection.investments.state.${movement.state}`);
  const acts = movement.proposal !== "tax_of_sale";
  const canConfirm = acts && movement.proposal !== "none";

  return (
    <li className={styles.row}>
      <Text size="sm" className={styles.label}>
        {label}
      </Text>
      <Text size="sm" className={styles.amount}>
        {total}
      </Text>
      <div className={styles.actions}>
        {pending && canConfirm && (
          <Button
            size="sm"
            variant="outline"
            disabled={disabled}
            onClick={() => {
              onConfirm(movement);
            }}
          >
            {t("connection.investments.confirm")}
          </Button>
        )}
        {pending && acts && (
          <Button
            size="sm"
            variant="ghost"
            disabled={disabled}
            onClick={() => {
              onDismiss(movement);
            }}
          >
            {t("connection.investments.dismiss")}
          </Button>
        )}
        {!pending && acts && (
          <>
            <Text size="sm" tone="muted">
              {stateWord}
            </Text>
            <Button
              size="sm"
              variant="ghost"
              disabled={disabled}
              onClick={() => {
                onUndo(movement);
              }}
            >
              {t("links.undo")}
            </Button>
          </>
        )}
      </div>
    </li>
  );
}
