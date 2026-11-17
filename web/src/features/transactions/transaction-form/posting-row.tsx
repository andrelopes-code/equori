import { IconButton } from "@slotted/react/button";
import { CurrencyField } from "@slotted/react/currency-field";
import { EntityPicker } from "@slotted/react/entity-picker";
import { Glyph, Icon } from "@slotted/react/icon";
import { TextField } from "@slotted/react/text-field";
import { Text } from "@slotted/react/typography";
import type { ComponentProps } from "react";

import type { EntryRow } from "@/features/transactions/entry-model/entry-kind";
import styles from "@/features/transactions/transaction-form/postings-editor.module.css";
import { useT } from "@/i18n/i18n-provider";

export interface PostingRowProps {
  // The position of the row, from 1, as its controls name it.
  position: number;
  row: EntryRow;
  items: ComponentProps<typeof EntityPicker>["items"];
  // The currency of the row's account, and the book's base currency.
  currency: string;
  baseCurrency: string;
  scale: (code: string) => number;
  removable: boolean;
  // The first refusal of the row: its account, its amount or its value in the base currency.
  error: string | undefined;
  invalid: { account: boolean; amount: boolean; baseAmount: boolean };
  onChange: (patch: Partial<EntryRow>) => void;
  onRemove: () => void;
}

// One posting of an advanced entry: account, amount, memo and remove. A row on an account in a
// currency other than the base also asks for the value of its amount in the base currency (DM1).
export function PostingRow({
  position,
  row,
  items,
  currency,
  baseCurrency,
  scale,
  removable,
  error,
  invalid,
  onChange,
  onRemove,
}: PostingRowProps) {
  const t = useT();

  return (
    <div className={styles.row}>
      <EntityPicker
        aria-label={t("entry.row.account", { index: position })}
        items={items}
        value={row.accountId}
        media="none"
        openOn="focus"
        invalid={invalid.account}
        onValueChange={(id) => {
          onChange({ accountId: id });
        }}
      />
      <CurrencyField
        aria-label={t("entry.row.amount", { index: position })}
        currency={currency}
        unit="minor"
        fractionDigits={scale(currency)}
        value={row.amount}
        invalid={invalid.amount}
        onValueChange={(value: number | null) => {
          onChange({ amount: value ?? 0 });
        }}
      />
      <TextField
        aria-label={t("entry.row.memo", { index: position })}
        placeholder={t("entry.row.memoPlaceholder")}
        value={row.memo}
        maxLength={500}
        onChange={(event) => {
          onChange({ memo: event.target.value });
        }}
      />
      <IconButton
        aria-label={t("entry.row.remove", { index: position })}
        variant="ghost"
        tone="secondary"
        disabled={!removable}
        onClick={onRemove}
      >
        <Icon>
          <Glyph name="x" />
        </Icon>
      </IconButton>
      {currency !== baseCurrency && (
        <CurrencyField
          className={styles.base}
          aria-label={t("entry.row.baseAmount", {
            index: position,
            currency: baseCurrency,
          })}
          currency={baseCurrency}
          unit="minor"
          fractionDigits={scale(baseCurrency)}
          value={row.baseAmount ?? 0}
          invalid={invalid.baseAmount}
          onValueChange={(value: number | null) => {
            onChange({ baseAmount: Math.abs(value ?? 0) });
          }}
        />
      )}
      {error !== undefined && (
        <Text size="sm" tone="danger" className={styles.error}>
          {error}
        </Text>
      )}
    </div>
  );
}
