import { Button, IconButton } from "@slotted/react/button";
import { CurrencyField } from "@slotted/react/currency-field";
import { Glyph, Icon } from "@slotted/react/icon";
import { InlineMessage } from "@slotted/react/inline-message";
import { Inline } from "@slotted/react/inline";
import { Stack } from "@slotted/react/stack";
import { Text } from "@slotted/react/typography";
import { useState } from "react";

import { ProblemError, errorText } from "@/api/problem";
import type { components } from "@/api/schema.gen";
import { CategoryMark, CategoryPicker } from "@/features/categories";
import type { CategoryEntry } from "@/features/categories";
import { useCategorizeTransaction } from "@/features/transactions/api";
import { currentParts } from "@/features/transactions/categorize";
import styles from "@/features/transactions/category-section.module.css";
import {
  majorFromMinor,
  minorFromMajor,
  splitState,
} from "@/features/transactions/split";
import type { SplitPart } from "@/features/transactions/split";
import { formatMoney } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";

type Account = components["schemas"]["Account"];
type Transaction = components["schemas"]["Transaction"];

export function CategorySection({
  transaction,
  accounts,
  categories,
  scale,
}: {
  transaction: Transaction;
  accounts: Map<string, Account>;
  categories: Map<string, CategoryEntry>;
  scale: (code: string) => number;
}) {
  const t = useT();
  const [locale] = useAppLocale();
  const categorize = useCategorizeTransaction();
  const parts = currentParts(transaction, accounts);
  const currency = parts[0]?.amount.currency ?? transaction.balancing_currency;
  const digits = scale(currency);
  const total = parts.reduce((sum, p) => sum + p.amount.amount, 0);
  // The editor works in the amounts a reader expects, positive; the sign of the total returns on save.
  const sign = total < 0 ? -1 : 1;
  const [draft, setDraft] = useState<SplitPart[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (parts.length === 0) {
    return <Text tone="muted">{t("detail.category.none")}</Text>;
  }

  const money = (amount: number) =>
    formatMoney({ amount, currency }, digits, locale);

  if (draft === null) {
    return (
      <Stack gap={3}>
        <ul className={styles.parts}>
          {parts.map((part) => {
            const entry = categories.get(part.account_id);
            return (
              <li key={part.account_id} className={styles.part}>
                <CategoryMark
                  name={entry?.name ?? ""}
                  color={entry?.color}
                  icon={entry?.icon}
                  size="md"
                />
                <Text
                  className={styles.name}
                  tone={entry?.uncategorized === true ? "warning" : "inherit"}
                >
                  {entry?.uncategorized === true
                    ? t("transactions.uncategorized")
                    : (entry?.path ?? "")}
                </Text>
                {parts.length > 1 && (
                  <Text numeric="tabular">
                    {money(part.amount.amount * sign)}
                  </Text>
                )}
              </li>
            );
          })}
        </ul>
        {transaction.voided_at === undefined && (
          <Inline gap={2}>
            <Button
              size="sm"
              variant="outline"
              tone="secondary"
              onClick={() => {
                setError(null);
                setDraft(
                  parts.map((p) => ({
                    categoryId: categories.get(p.account_id)?.uncategorized
                      ? null
                      : p.account_id,
                    amount: p.amount.amount * sign,
                  })),
                );
              }}
            >
              {parts.length > 1
                ? t("detail.category.edit")
                : t("detail.category.change")}
            </Button>
          </Inline>
        )}
      </Stack>
    );
  }

  const state = splitState(total * sign, draft);
  const setPart = (index: number, patch: Partial<SplitPart>) => {
    setDraft(draft.map((p, i) => (i === index ? { ...p, ...patch } : p)));
  };
  const save = async () => {
    setError(null);
    try {
      await categorize.mutateAsync({
        current: transaction,
        parts: draft.map((p) => ({
          account_id: p.categoryId ?? "",
          amount: { amount: p.amount * sign, currency },
        })),
      });
      setDraft(null);
    } catch (caught) {
      // A conflict means the transaction moved: the query is read again and the editor closes.
      if (caught instanceof ProblemError && caught.status === 409) {
        setDraft(null);
      }
      setError(errorText(caught, t));
    }
  };

  return (
    <Stack gap={3}>
      {draft.map((part, index) => (
        <div key={index} className={styles.row}>
          <CategoryPicker
            aria-label={t("detail.category.partCategory", {
              index: index + 1,
            })}
            value={part.categoryId}
            amount={-total}
            onChange={(id) => {
              setPart(index, { categoryId: id });
            }}
          />
          {draft.length > 1 && (
            <CurrencyField
              aria-label={t("detail.category.partAmount", { index: index + 1 })}
              currency={currency}
              value={majorFromMinor(part.amount, digits)}
              onValueChange={(value: number | null) => {
                setPart(index, { amount: minorFromMajor(value ?? 0, digits) });
              }}
            />
          )}
          {draft.length > 1 && (
            <IconButton
              aria-label={t("detail.category.removePart", { index: index + 1 })}
              variant="ghost"
              tone="secondary"
              onClick={() => {
                setDraft(draft.filter((_, i) => i !== index));
              }}
            >
              <Icon>
                <Glyph name="x" />
              </Icon>
            </IconButton>
          )}
        </div>
      ))}
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
            const remaining = Math.max(state.remaining, 0);
            setDraft([...draft, { categoryId: null, amount: remaining }]);
          }}
        >
          {t("detail.category.addPart")}
        </Button>
        {draft.length > 1 && (
          <Text
            size="sm"
            tone={state.remaining === 0 ? "muted" : "warning"}
            numeric="tabular"
            aria-live="polite"
          >
            {state.remaining === 0
              ? t("detail.category.balanced")
              : t("detail.category.remaining", {
                  amount: money(state.remaining),
                })}
          </Text>
        )}
      </Inline>
      {error !== null && <InlineMessage tone="danger">{error}</InlineMessage>}
      <Inline gap={2} justify="end">
        <Button
          size="sm"
          variant="ghost"
          tone="secondary"
          onClick={() => {
            setDraft(null);
          }}
        >
          {t("detail.cancel")}
        </Button>
        <Button
          size="sm"
          loading={categorize.isPending}
          disabled={!state.ready}
          onClick={() => {
            void save();
          }}
        >
          {t("detail.save")}
        </Button>
      </Inline>
    </Stack>
  );
}
