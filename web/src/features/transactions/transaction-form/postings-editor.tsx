import { Button } from "@slotted/react/button";
import { Glyph, Icon } from "@slotted/react/icon";
import { Inline } from "@slotted/react/inline";
import { Stack } from "@slotted/react/stack";
import { Text } from "@slotted/react/typography";
import { useMemo } from "react";

import type { components } from "@/api/schema.gen";
import { useCategoryEntries } from "@/features/categories";
import { imbalance } from "@/features/transactions/entry-model/entry-kind";
import type { EntryRow } from "@/features/transactions/entry-model/entry-kind";
import { PostingRow } from "@/features/transactions/transaction-form/posting-row";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";

type Account = components["schemas"]["Account"];

export interface PostingsEditorProps {
  rows: readonly EntryRow[];
  onChange: (rows: EntryRow[]) => void;
  accounts: readonly Account[];
  baseCurrency: string;
  scale: (code: string) => number;
  errors: Record<string, string>;
}

// Advanced entry: any number of postings on any accounts; their values in the base currency must
// add up to zero.
export function PostingsEditor({
  rows,
  onChange,
  accounts,
  baseCurrency,
  scale,
  errors,
}: PostingsEditorProps) {
  const t = useT();
  const [locale] = useAppLocale();
  const fmt = useMoneyFormat();
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
  const left = imbalance(rows, byId, baseCurrency);

  const set = (index: number, patch: Partial<EntryRow>) => {
    onChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  return (
    <Stack gap={3}>
      {rows.map((row, index) => {
        const field = `postings[${String(index)}]`;
        const accountError = errors[`${field}.account_id`];
        const amountError = errors[`${field}.amount`];
        const baseError = errors[`${field}.weight`];

        return (
          <PostingRow
            key={index}
            position={index + 1}
            row={row}
            items={items}
            currency={
              (row.accountId === null
                ? undefined
                : byId.get(row.accountId)?.currency) ?? baseCurrency
            }
            baseCurrency={baseCurrency}
            scale={scale}
            removable={rows.length > 2}
            error={accountError ?? amountError ?? baseError}
            invalid={{
              account: accountError !== undefined,
              amount: amountError !== undefined,
              baseAmount: baseError !== undefined,
            }}
            onChange={(patch) => {
              set(index, patch);
            }}
            onRemove={() => {
              onChange(rows.filter((_, i) => i !== index));
            }}
          />
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
                amount: fmt.money(
                  { amount: left, currency: baseCurrency },
                  scale(baseCurrency),
                ),
              })}
        </Text>
      </Inline>
    </Stack>
  );
}
