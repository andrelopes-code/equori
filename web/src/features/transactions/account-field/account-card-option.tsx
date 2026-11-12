import type { CSSProperties, KeyboardEvent } from "react";

import { accountCardColor } from "@/features/accounts";
import { rowTextOf } from "@/features/transactions/account-field/account-row-text";
import {
  litSegments,
  meterSegments,
} from "@/features/transactions/account-field/limit-meter";
import type { AccountChoice } from "@/features/transactions/account-field/use-account-choices";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";
import { Glyph, Icon } from "@slotted/react/icon";

import styles from "@/features/transactions/account-field/account-card-option.module.css";

interface AccountCardOptionProps {
  choice: AccountChoice;
  chosen: boolean;
  // The one option of the list that Tab reaches (roving tab stop).
  tabStop: boolean;
  scale: number;
  onPick: (id: string) => void;
}

const segments = Array.from({ length: meterSegments }, (_, n) => n);

// Families read: card, listbox. A card family draws a container for content, not a choice of a
// listbox; the picker needs the wallet card of the Cards page (account-card.module.css) as an
// option with role option, which no family draws. The element belongs to AccountSectionList
// (Slotted issues #94 and #95).
export function AccountCardOption({
  choice,
  chosen,
  tabStop,
  scale,
  onPick,
}: AccountCardOptionProps) {
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
  const free =
    choice.freeLimit === undefined
      ? null
      : fmt.parts(
          { amount: choice.freeLimit, currency: account.currency },
          scale,
        );
  const lit = litSegments(choice.creditLimit, choice.freeLimit);
  const ground = accountCardColor(account.color);
  const style = (
    ground === undefined ? undefined : { "--account-card-color": ground }
  ) as CSSProperties | undefined;
  const note = closedNote(text.fact);

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
      className={styles.card}
      style={style}
      role="option"
      tabIndex={tabStop ? 0 : -1}
      aria-selected={chosen}
      aria-disabled={disabled || undefined}
      data-key={account.id}
      data-colour={ground === undefined ? undefined : ""}
      data-lit={lit ?? undefined}
      onClick={handlePick}
      onKeyDown={handleKeyDown}
    >
      <span className={styles.head}>
        {choice.logo !== undefined && (
          <span className={styles.tile}>
            <img className={styles.logo} src={choice.logo} alt="" />
          </span>
        )}
        <span className={styles.name}>{account.name}</span>
      </span>

      <span className={styles.foot}>
        <span className={styles.fact}>
          <span className={styles.ellipsis}>{text.fact?.short}</span>
          {note !== "" && <span>{note}</span>}
        </span>

        {free !== null && (
          <span className={styles.figure}>
            <span className={styles.symbol}>{free.symbol}</span>
            <span className={styles.integer}>{free.integer}</span>
            <span className={styles.fraction}>{free.fraction}</span>
            <span className={styles.label}>
              {t("accountChoice.label.free")}
            </span>
          </span>
        )}

        {lit !== null && (
          <span className={styles.meter} aria-hidden="true">
            {segments.map((n) => (
              <span
                key={n}
                className={styles.segment}
                data-segment=""
                data-on={n < lit ? "" : undefined}
              />
            ))}
          </span>
        )}
      </span>

      {chosen && (
        <span className={styles.check}>
          <Icon size="sm">
            <Glyph name="check" />
          </Icon>
        </span>
      )}
    </div>
  );
}

// The closing note is what the long form adds after the short one ("Fatura de 17/12 · fechou
// dia 10"); it sits at the end of the same line.
function closedNote(fact: { long: string; short: string } | null | undefined) {
  if (fact === null || fact === undefined) return "";
  if (!fact.long.startsWith(fact.short)) return "";

  return fact.long.slice(fact.short.length).replace(/^[\s·]+/, "");
}
