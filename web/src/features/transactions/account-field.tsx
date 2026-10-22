import { useField } from "@slotted/react/field";
import { useEffect, useId, useState } from "react";

import type { components } from "@/api/schema.gen";
import { AccountMark } from "@/features/accounts";
import styles from "@/features/transactions/account-field.module.css";
import { AccountDetail } from "@/features/transactions/account-detail";
import {
  groupAccounts,
  pickable,
} from "@/features/transactions/account-groups";
import { AccountOptionList } from "@/features/transactions/account-option-list";
import { AccountSheet } from "@/features/transactions/account-sheet";
import { ConsequenceSentence } from "@/features/transactions/consequence-sentence";
import { useAccountChoices } from "@/features/transactions/use-account-choices";
import type { MessageKey } from "@/i18n/catalog.en";
import { formatMoney } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useMediaQuery, wideQuery } from "@/ui/use-media-query";

type Account = components["schemas"]["Account"];

// The account an entry moves money through. Each option says what choosing it does with the
// amount; a wide screen shows them all as tiles, a phone a field that opens them in a sheet.
export function AccountField({
  accounts,
  value,
  onChange,
  exclude,
  name,
  title,
  amount,
  direction,
  date,
  categoryId,
  payeeId,
  kind,
  currency,
  scale,
  compact = false,
  context: contextText,
}: {
  accounts: readonly Account[];
  value: string | null;
  onChange: (id: string) => void;
  exclude: string | null;
  // The radio group's name; two account fields on one form need two.
  name: string;
  // The field's label, which titles the sheet.
  title: string;
  amount: number;
  direction: "out" | "in";
  date: string;
  categoryId: string | null;
  payeeId: string | null;
  kind: "expense" | "income" | "transfer";
  // The amount's currency: the chosen account's, or the base currency before one is chosen.
  currency: string;
  scale: (currency: string) => number;
  // A field that names an account before any amount is known, such as the capture's default
  // account, opens the sheet at every width and states no consequence.
  compact?: boolean;
  // The sheet's description, in place of the one the amount and kind compose.
  context?: string;
}) {
  const t = useT();
  const [locale] = useAppLocale();
  const wide = useMediaQuery(wideQuery);
  const field = useField();
  const register = field?.registerControl;
  useEffect(() => {
    register?.();
  }, [register]);
  const sentenceId = useId();
  const triggerId = useId();
  const [open, setOpen] = useState(false);

  const collator = new Intl.Collator(locale, { sensitivity: "base" });
  const offered = groupAccounts(
    pickable(accounts, value, exclude),
    collator,
  ).flatMap((g) => g.accounts);
  const { choices: computed, suggestion } = useAccountChoices({
    accounts: offered,
    all: accounts,
    amount,
    direction,
    date,
    categoryId,
    payeeId,
  });
  // Without an amount an option has no consequence to state.
  const choices = compact
    ? computed.map((c) => ({ ...c, consequence: null }))
    : computed;
  const chosen = choices.find((c) => c.account.id === value);
  const describedBy = [compact ? undefined : sentenceId, field?.describedBy]
    .filter((id) => id !== undefined && id !== "")
    .join(" ");

  const sentence = compact ? null : (
    <ConsequenceSentence
      id={sentenceId}
      account={chosen?.account}
      consequence={chosen?.consequence ?? null}
      scale={chosen === undefined ? 0 : scale(chosen.account.currency)}
    />
  );

  if (wide && !compact) {
    return (
      <div className={styles.field}>
        <AccountOptionList
          choices={choices}
          value={value}
          name={name}
          suggestion={suggestion}
          scale={scale}
          labelledBy={field?.ids.label}
          describedBy={describedBy}
          onChange={onChange}
        />
        {sentence}
      </div>
    );
  }

  const category = accounts.find((a) => a.id === categoryId)?.name;
  const figure = formatMoney({ amount, currency }, scale(currency), locale);
  const context =
    contextText ??
    (kind === "transfer"
      ? t("accountChoice.context.transfer", { amount: figure })
      : category === undefined
        ? t(`accountChoice.context.${kind}`, { amount: figure })
        : t(`accountChoice.context.${kind}In` as MessageKey, {
            amount: figure,
            category,
          }));

  return (
    <div className={styles.field}>
      <button
        type="button"
        id={field?.ids.control}
        aria-labelledby={
          field === undefined ? undefined : `${field.ids.label} ${triggerId}`
        }
        className={styles.trigger}
        aria-haspopup="dialog"
        aria-describedby={describedBy}
        aria-invalid={field?.invalid === true ? true : undefined}
        onClick={() => {
          setOpen(true);
        }}
      >
        {chosen === undefined ? (
          <span id={triggerId} className={styles.placeholder}>
            {t("accountChoice.choose")}
          </span>
        ) : (
          <>
            <AccountMark
              shape={chosen.shape}
              name={chosen.institution ?? chosen.account.name}
              color={chosen.account.color}
              logo={chosen.logo}
              progress={chosen.progress}
              size="md"
            />
            <span id={triggerId} className={styles.text}>
              <span className={styles.name}>{chosen.account.name}</span>
              <span className={styles.detail}>
                <AccountDetail
                  choice={chosen}
                  scale={scale(chosen.account.currency)}
                />
              </span>
            </span>
          </>
        )}
        <span className={styles.change} aria-hidden="true">
          {t("accountChoice.change")}
        </span>
      </button>
      {sentence}
      {open && (
        <AccountSheet
          title={title}
          context={context}
          choices={choices}
          value={value}
          name={`${name}-sheet`}
          suggestion={suggestion}
          scale={scale}
          onPick={(id) => {
            onChange(id);
            setOpen(false);
          }}
          onClose={() => {
            setOpen(false);
          }}
        />
      )}
    </div>
  );
}
