import { parseISODate, toISODate } from "@slotted/core/date";
import { DatePicker } from "@slotted/react/date-picker";
import { Field, FieldError, FieldLabel } from "@slotted/react/field";
import { Stack } from "@slotted/react/stack";
import { TextField } from "@slotted/react/text-field";
import type { ReactNode } from "react";

import type { components } from "@/api/schema.gen";
import { CategoryPicker } from "@/features/categories";
import { AccountField } from "@/features/transactions/account-field";
import { DateShortcuts } from "@/ui/date-shortcuts";
import { EntryKindPicker } from "@/features/transactions/entry-kind-picker";
import { isBuiltKind } from "@/features/transactions/entry-kind";
import type {
  EntryDraft,
  EntryKind,
  PostingKind,
} from "@/features/transactions/entry-kind";
import { PayeeField } from "@/features/transactions/payee-field";
import { PostingsEditor } from "@/features/transactions/postings-editor";
import { TagsField } from "@/features/transactions/tags-field";
import styles from "@/features/transactions/transaction-form.module.css";
import { useT } from "@/i18n/i18n-provider";
import { MoneyInput } from "@/ui/money-input";

type Account = components["schemas"]["Account"];
type Payee = components["schemas"]["Payee"];

// The request's posting field names, read back into the field that wrote them (FM-02).
export function fieldOf(kind: PostingKind, field: string): string {
  if (kind === "advanced") return field;
  if (field.startsWith("postings[0]")) return "account";
  if (field.startsWith("postings[1]"))
    return kind === "transfer" ? "to" : "category";
  if (field.startsWith("tags")) return "tags";
  return field;
}

export function TransactionForm({
  draft,
  onChange,
  accounts,
  payees,
  tags,
  baseCurrency,
  scale,
  errors,
  autoFocusAmount = false,
  onInvestment,
  children,
}: {
  draft: EntryDraft;
  onChange: (draft: EntryDraft) => void;
  accounts: readonly Account[];
  payees: readonly Payee[];
  tags: readonly string[];
  baseCurrency: string;
  scale: (code: string) => number;
  errors: Record<string, string>;
  // A new entry starts at its amount; a correction leaves focus where the page puts it.
  autoFocusAmount?: boolean;
  // The new-entry flow also offers the trade; the page switches forms when it is chosen.
  onInvestment?: (kind: EntryKind) => void;
  // Fields only one of the forms has, such as the reason of a correction.
  children?: ReactNode;
}) {
  const t = useT();
  const set = (patch: Partial<EntryDraft>) => {
    onChange({ ...draft, ...patch });
  };
  const account =
    draft.accountId === null
      ? undefined
      : accounts.find((a) => a.id === draft.accountId);
  const currency = account?.currency ?? baseCurrency;
  const digits = scale(currency);
  const error = (name: string) => errors[name];
  const simple = draft.kind !== "advanced";
  const simpleKind = draft.kind === "advanced" ? null : draft.kind;
  const accountLabel =
    draft.kind === "transfer"
      ? t("entry.from")
      : draft.kind === "income"
        ? t("entry.receiveIn")
        : t("entry.payWith");

  return (
    <Stack gap={6}>
      <EntryKindPicker
        value={draft.kind}
        investments={onInvestment !== undefined}
        onChange={(kind) => {
          if (isBuiltKind(kind)) {
            onInvestment?.(kind);
          } else {
            set({ kind });
          }
        }}
      />

      {simple && (
        <Field invalid={error("amount") !== undefined}>
          <FieldLabel>{t("entry.amount")}</FieldLabel>
          <MoneyInput
            value={draft.amount}
            currency={currency}
            scale={digits}
            sign={
              draft.kind === "expense"
                ? "expense"
                : draft.kind === "income"
                  ? "income"
                  : "neutral"
            }
            autoFocus={autoFocusAmount}
            onChange={(amount) => {
              set({ amount });
            }}
          />
          {error("amount") !== undefined && (
            <FieldError>{error("amount")}</FieldError>
          )}
        </Field>
      )}

      {simpleKind !== null && (
        <Field invalid={error("account") !== undefined}>
          <FieldLabel>{accountLabel}</FieldLabel>
          <AccountField
            name="account"
            title={accountLabel}
            accounts={accounts}
            value={draft.accountId}
            exclude={draft.kind === "transfer" ? draft.toAccountId : null}
            amount={draft.amount}
            direction={draft.kind === "income" ? "in" : "out"}
            date={draft.date}
            categoryId={draft.kind === "transfer" ? null : draft.categoryId}
            payeeId={draft.kind === "transfer" ? null : draft.payeeId}
            kind={simpleKind}
            currency={currency}
            scale={scale}
            onChange={(id) => {
              set({ accountId: id });
            }}
          />
          {error("account") !== undefined && (
            <FieldError>{error("account")}</FieldError>
          )}
        </Field>
      )}

      {draft.kind === "transfer" && (
        <Field invalid={error("to") !== undefined}>
          <FieldLabel>{t("entry.to")}</FieldLabel>
          <AccountField
            name="to"
            title={t("entry.to")}
            accounts={accounts}
            value={draft.toAccountId}
            exclude={draft.accountId}
            amount={draft.amount}
            direction="in"
            date={draft.date}
            categoryId={null}
            payeeId={null}
            kind="transfer"
            currency={currency}
            scale={scale}
            onChange={(id) => {
              set({ toAccountId: id });
            }}
          />
          {error("to") !== undefined && <FieldError>{error("to")}</FieldError>}
        </Field>
      )}

      <Field invalid={error("date") !== undefined}>
        <FieldLabel>{t("entry.date")}</FieldLabel>
        <div className={styles.date}>
          <DatePicker
            name="date"
            value={parseISODate(draft.date)}
            onValueChange={(value) => {
              if (value !== null && !Array.isArray(value) && "year" in value) {
                set({ date: toISODate(value) });
              }
            }}
          />
          <DateShortcuts
            value={draft.date}
            onChange={(date) => {
              set({ date });
            }}
          />
        </div>
        {error("date") !== undefined && (
          <FieldError>{error("date")}</FieldError>
        )}
      </Field>

      {(draft.kind === "expense" || draft.kind === "income") && (
        <div className={styles.pair}>
          <Field invalid={error("category") !== undefined}>
            <FieldLabel>{t("category.label")}</FieldLabel>
            <CategoryPicker
              placeholder={t("entry.categoryPlaceholder")}
              value={draft.categoryId}
              amount={draft.kind === "income" ? 1 : -1}
              onChange={(id) => {
                set({ categoryId: id });
              }}
            />
            {error("category") !== undefined && (
              <FieldError>{error("category")}</FieldError>
            )}
          </Field>
          <Field invalid={error("payee_id") !== undefined}>
            <FieldLabel>{t("facts.payee")}</FieldLabel>
            <PayeeField
              placeholder={t("entry.payeePlaceholder")}
              payees={payees}
              value={draft.payeeId}
              onChange={(id) => {
                set({ payeeId: id });
              }}
            />
            {error("payee_id") !== undefined && (
              <FieldError>{error("payee_id")}</FieldError>
            )}
          </Field>
        </div>
      )}

      {draft.kind === "advanced" && (
        <Field>
          <FieldLabel>{t("detail.postings")}</FieldLabel>
          <PostingsEditor
            rows={draft.rows}
            onChange={(rows) => {
              set({ rows });
            }}
            accounts={accounts}
            baseCurrency={baseCurrency}
            scale={scale}
            errors={errors}
          />
        </Field>
      )}

      <Field invalid={error("description") !== undefined}>
        <FieldLabel>{t("facts.description")}</FieldLabel>
        <TextField
          name="description"
          value={draft.description}
          maxLength={500}
          onChange={(event) => {
            set({ description: event.target.value });
          }}
        />
        {error("description") !== undefined && (
          <FieldError>{error("description")}</FieldError>
        )}
      </Field>

      <Field invalid={error("tags") !== undefined}>
        <FieldLabel>{t("facts.tags")}</FieldLabel>
        <TagsField
          placeholder={t("entry.tagsPlaceholder")}
          tags={tags}
          value={draft.tags}
          onChange={(value) => {
            set({ tags: value });
          }}
        />
        {error("tags") !== undefined && (
          <FieldError>{error("tags")}</FieldError>
        )}
      </Field>

      {children}
    </Stack>
  );
}
