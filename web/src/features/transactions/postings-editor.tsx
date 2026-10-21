import { Button, IconButton } from "@slotted/react/button";
import { CurrencyField } from "@slotted/react/currency-field";
import { EntityPicker } from "@slotted/react/entity-picker";
import { Glyph, Icon } from "@slotted/react/icon";
import { Inline } from "@slotted/react/inline";
import { Stack } from "@slotted/react/stack";
import { TextField } from "@slotted/react/text-field";
import { Text } from "@slotted/react/typography";
import { useMemo } from "react";

import type { components } from "@/api/schema.gen";
import { useCategoryEntries } from "@/features/categories";
import { imbalance } from "@/features/transactions/entry-kind";
import type { EntryRow } from "@/features/transactions/entry-kind";
import styles from "@/features/transactions/postings-editor.module.css";
import { majorFromMinor, minorFromMajor } from "@/features/transactions/split";
import { formatMoney } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";

type Account = components["schemas"]["Account"];

// Advanced entry: any number of postings on any accounts; the sum per currency must be zero.
export function PostingsEditor({
  rows,
  onChange,
  accounts,
  baseCurrency,
  scale,
  errors,
}: {
  rows: readonly EntryRow[];
  onChange: (rows: EntryRow[]) => void;
  accounts: readonly Account[];
  baseCurrency: string;
  scale: (code: string) => number;
  errors: Record<string, string>;
}) {
  const t = useT();
  const [locale] = useAppLocale();
  const entries = useCategoryEntries(accounts);
  const byId = useMemo(
    () => new Map(accounts.map((a) => [a.id, a])),
    [accounts],
  );
  const items = useMemo(() => {
    const paths = new Map(entries.map((c) => [c.id, c.path]));
    const collator = new Intl.Collator(locale, { sensitivity: "base" });
    return accounts
      .filter((a) => a.closed_on === undefined)
      .map((a) => ({
        id: a.id,
        label: paths.get(a.id) ?? a.name,
        group:
          a.class === "asset" || a.class === "liability"
            ? t("entry.group.accounts")
            : a.class === "equity"
              ? t("entry.group.equity")
              : t("entry.group.categories"),
        avatar: null,
      }))
      .sort((a, b) => collator.compare(a.label, b.label));
  }, [accounts, entries, locale, t]);

  const set = (index: number, patch: Partial<EntryRow>) => {
    onChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };
  const left = imbalance(rows);
  const currency =
    (rows[0]?.accountId === null || rows[0] === undefined
      ? undefined
      : byId.get(rows[0].accountId)?.currency) ?? baseCurrency;

  return (
    <Stack gap={3}>
      {rows.map((row, index) => {
        const rowCurrency =
          (row.accountId === null
            ? undefined
            : byId.get(row.accountId)?.currency) ?? baseCurrency;
        const digits = scale(rowCurrency);
        const accountError = errors[`postings[${String(index)}].account_id`];
        const amountError = errors[`postings[${String(index)}].amount`];
        return (
          <div key={index} className={styles.row}>
            <EntityPicker
              aria-label={t("entry.row.account", { index: index + 1 })}
              items={items}
              value={row.accountId}
              media="none"
              openOn="focus"
              invalid={accountError !== undefined}
              onValueChange={(id) => {
                set(index, { accountId: id });
              }}
            />
            <CurrencyField
              aria-label={t("entry.row.amount", { index: index + 1 })}
              currency={rowCurrency}
              value={majorFromMinor(row.amount, digits)}
              invalid={amountError !== undefined}
              onValueChange={(value: number | null) => {
                set(index, { amount: minorFromMajor(value ?? 0, digits) });
              }}
            />
            <TextField
              aria-label={t("entry.row.memo", { index: index + 1 })}
              placeholder={t("entry.row.memoPlaceholder")}
              value={row.memo}
              maxLength={500}
              onChange={(event) => {
                set(index, { memo: event.target.value });
              }}
            />
            <IconButton
              aria-label={t("entry.row.remove", { index: index + 1 })}
              variant="ghost"
              tone="secondary"
              disabled={rows.length <= 2}
              onClick={() => {
                onChange(rows.filter((_, i) => i !== index));
              }}
            >
              <Icon>
                <Glyph name="x" />
              </Icon>
            </IconButton>
            {(accountError ?? amountError) !== undefined && (
              <Text size="sm" tone="danger" className={styles.error}>
                {accountError ?? amountError}
              </Text>
            )}
          </div>
        );
      })}
      <Inline gap={3} justify="between">
        <Button
          size="sm"
          variant="ghost"
          tone="secondary"
          start={
            <Icon size="sm">
              <Glyph name="plus" />
            </Icon>
          }
          onClick={() => {
            onChange([...rows, { accountId: null, amount: -left, memo: "" }]);
          }}
        >
          {t("entry.row.add")}
        </Button>
        <Text
          size="sm"
          numeric="tabular"
          tone={left === 0 ? "muted" : "warning"}
          aria-live="polite"
        >
          {left === 0
            ? t("entry.balanced")
            : t("entry.unbalanced", {
                amount: formatMoney(
                  { amount: left, currency },
                  scale(currency),
                  locale,
                ),
              })}
        </Text>
      </Inline>
    </Stack>
  );
}
