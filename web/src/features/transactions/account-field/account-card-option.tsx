import { Glyph, Icon } from "@slotted/react/icon";
import { useQuery } from "@tanstack/react-query";
import type { KeyboardEvent } from "react";

import { useApi } from "@/api/api-context";
import { cardsQuery } from "@/features/cards";
import { rowTextOf } from "@/features/transactions/account-field/account-row-text";
import {
  litSegments,
  meterSegments,
} from "@/features/transactions/account-field/limit-meter";
import type { AccountChoice } from "@/features/transactions/account-field/use-account-choices";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";
import { CardFace } from "@/ui/card-face/card-face";
import { useFaceAppearance } from "@/ui/card-face/use-face-appearance";

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
// listbox; the picker needs the card face of the Cards page (ui/card-face) as an option with role
// option, with what the choice costs under it, which no family draws. The element belongs to
// AccountSectionList (Slotted issues #94 and #95).
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
  const plastics = useQuery(cardsQuery(useApi(), account.id));
  const appearance = useFaceAppearance(
    account.face,
    account.color,
    choice.logo,
  );
  const plastic = plastics.data?.find((card) => card.active);

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
  const note = text.fact?.note ?? null;
  const lit = litSegments(choice.creditLimit, choice.freeLimit);
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
      className={styles.option}
      role="option"
      tabIndex={tabStop ? 0 : -1}
      aria-selected={chosen}
      aria-disabled={disabled || undefined}
      data-key={account.id}
      data-lit={lit ?? undefined}
      onClick={handlePick}
      onKeyDown={handleKeyDown}
    >
      <span className={styles.face}>
        <CardFace
          title={account.name}
          {...(choice.logo === undefined ? {} : { logo: choice.logo })}
          {...(choice.institution === undefined
            ? {}
            : { institutionName: choice.institution })}
          holder=""
          {...(plastic === undefined ? {} : { lastFour: plastic.last_four })}
          {...(plastic?.network === undefined
            ? {}
            : { network: plastic.network })}
          {...appearance.props}
        />

        {chosen && (
          <span className={styles.check}>
            <Icon size="sm">
              <Glyph name="check" />
            </Icon>
          </span>
        )}
      </span>

      <span className={styles.caption}>
        <span className={styles.fact}>
          <span className={styles.ellipsis}>{text.fact?.short}</span>
          {note !== null && <span>{note}</span>}
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
    </div>
  );
}
