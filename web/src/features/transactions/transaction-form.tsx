import { parseISODate, toISODate } from "@slotted/core/date";
import { CurrencyField } from "@slotted/react/currency-field";
import { DatePicker } from "@slotted/react/date-picker";
import { Field, FieldError, FieldLabel } from "@slotted/react/field";
import { Segment, SegmentedControl } from "@slotted/react/segmented-control";
import { Stack } from "@slotted/react/stack";
import { TextField } from "@slotted/react/text-field";
import type { ReactNode } from "react";

import type { components } from "@/api/schema.gen";
import { CategoryPicker } from "@/features/categories";
import { AccountSelect } from "@/features/transactions/account-select";
import type { EntryDraft, EntryKind } from "@/features/transactions/entry-kind";
import { PayeeField } from "@/features/transactions/payee-field";
import { PostingsEditor } from "@/features/transactions/postings-editor";
import { TagsField } from "@/features/transactions/tags-field";
import { majorFromMinor, minorFromMajor } from "@/features/transactions/split";
import styles from "@/features/transactions/transaction-form.module.css";
import type { MessageKey } from "@/i18n/catalog.en";
import { useT } from "@/i18n/i18n-provider";

type Account = components["schemas"]["Account"];
type Payee = components["schemas"]["Payee"];

const kinds: { value: EntryKind; label: MessageKey }[] = [
  { value: "expense", label: "entry.kind.expense" },
  { value: "income", label: "entry.kind.income" },
  { value: "transfer", label: "entry.kind.transfer" },
  { value: "advanced", label: "entry.kind.advanced" },
];

// The request's posting field names, read back into the field that wrote them (FM-02).
export function fieldOf(kind: EntryKind, field: string): string {
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

  return (
    <Stack gap={6}>
      <SegmentedControl
        aria-label={t("entry.kind")}
        value={draft.kind}
        fullWidth
        onValueChange={(value) => {
          const next = kinds.find((k) => k.value === value);
          if (next !== undefined) set({ kind: next.value });
        }}
      >
        {kinds.map((kind) => (
          <Segment key={kind.value} value={kind.value}>
            {t(kind.label)}
          </Segment>
        ))}
      </SegmentedControl>

      {simple && (
        <Field invalid={error("amount") !== undefined}>
          <FieldLabel>{t("entry.amount")}</FieldLabel>
          <CurrencyField
            appearance="display"
            currency={currency}
            min={0}
            value={
              draft.amount === 0 ? null : majorFromMinor(draft.amount, digits)
            }
            onValueChange={(value: number | null) => {
              set({ amount: minorFromMajor(Math.abs(value ?? 0), digits) });
            }}
          />
          {error("amount") !== undefined && (
            <FieldError>{error("amount")}</FieldError>
          )}
        </Field>
      )}

      <div className={styles.pair}>
        <Field invalid={error("date") !== undefined}>
          <FieldLabel>{t("entry.date")}</FieldLabel>
          <DatePicker
            name="date"
            value={parseISODate(draft.date)}
            onValueChange={(value) => {
              if (value !== null && !Array.isArray(value) && "year" in value) {
                set({ date: toISODate(value) });
              }
            }}
          />
          {error("date") !== undefined && (
            <FieldError>{error("date")}</FieldError>
          )}
        </Field>
        {simple && (
          <Field invalid={error("account") !== undefined}>
            <FieldLabel>
              {draft.kind === "transfer" ? t("entry.from") : t("entry.account")}
            </FieldLabel>
            <AccountSelect
              accounts={accounts}
              value={draft.accountId}
              exclude={draft.kind === "transfer" ? draft.toAccountId : null}
              placeholder={t("entry.chooseAccount")}
              onChange={(id) => {
                set({ accountId: id });
              }}
            />
            {error("account") !== undefined && (
              <FieldError>{error("account")}</FieldError>
            )}
          </Field>
        )}
      </div>

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

      {draft.kind === "transfer" && (
        <Field invalid={error("to") !== undefined}>
          <FieldLabel>{t("entry.to")}</FieldLabel>
          <AccountSelect
            accounts={accounts}
            value={draft.toAccountId}
            exclude={draft.accountId}
            placeholder={t("entry.chooseAccount")}
            onChange={(id) => {
              set({ toAccountId: id });
            }}
          />
          {error("to") !== undefined && <FieldError>{error("to")}</FieldError>}
        </Field>
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
