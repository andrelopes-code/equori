import type { KeyboardEvent } from "react";

import { AccountMark } from "@/features/accounts";
import { CardThumb } from "@/features/transactions/account-field/card-thumb";
import { rowTextOf } from "@/features/transactions/account-field/account-row-text";
import type { AccountChoice } from "@/features/transactions/account-field/use-account-choices";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";
import { Glyph, Icon } from "@slotted/react/icon";

import styles from "@/features/transactions/account-field/account-row.module.css";

interface AccountRowProps {
  choice: AccountChoice;
  chosen: boolean;
  // The one option of the list that Tab reaches (roving tab stop).
  tabStop: boolean;
  scale: number;
  onPick: (id: string) => void;
}

export function AccountRow({
  choice,
  chosen,
  tabStop,
  scale,
  onPick,
}: AccountRowProps) {
  const t = useT();
  const [locale] = useAppLocale();
  const fmt = useMoneyFormat();
  const { account } = choice;

  const disabled = choice.unavailable !== null;
  const text = rowTextOf(choice, {
    t,
    locale,
    money: (amount) => fmt.money({ amount, currency: account.currency }, scale),
  });

  function handlePick() {
    if (!disabled) onPick(account.id);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget) return;
    if (event.key !== "Enter" && event.key !== " ") return;

    event.preventDefault();
    handlePick();
  }

  return (
    <div
      className={styles.row}
      role="option"
      tabIndex={tabStop ? 0 : -1}
      aria-selected={chosen}
      aria-disabled={disabled || undefined}
      data-key={account.id}
      onClick={handlePick}
      onKeyDown={handleKeyDown}
    >
      <span className={styles.mark}>
        {choice.group === "cards" ? (
          <CardThumb account={account} logo={choice.logo} disabled={disabled} />
        ) : (
          <AccountMark
            shape={choice.shape}
            name={choice.institution ?? account.name}
            color={account.color}
            logo={choice.logo}
            progress={choice.progress}
            size="md"
            disabled={disabled}
          />
        )}
        {chosen && (
          <span className={styles.check}>
            <Icon size="sm">
              <Glyph name="check" />
            </Icon>
          </span>
        )}
      </span>

      <span className={styles.text}>
        <span className={styles.name}>{account.name}</span>
        {text.fact !== null && (
          <span className={styles.fact} data-tone={text.fact.tone}>
            <span className={styles.long}>{text.fact.long}</span>
            {text.fact.short !== text.fact.long && (
              <span className={styles.short}>{text.fact.short}</span>
            )}
          </span>
        )}
      </span>

      {text.figure !== null && (
        <span className={styles.figure}>
          <span className={styles.value}>{text.figure}</span>
          {text.label !== null && (
            <span className={styles.label} data-tone={text.label.tone}>
              {text.label.text}
            </span>
          )}
        </span>
      )}
    </div>
  );
}
