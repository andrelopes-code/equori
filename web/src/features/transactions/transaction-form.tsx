import { Field, FieldError, FieldLabel } from "@slotted/react/field";
import { TextField } from "@slotted/react/text-field";
import type { ReactNode } from "react";

import type { components } from "@/api/schema.gen";
import { AccountField } from "@/features/transactions/account-field";
import { groupOf } from "@/features/transactions/account-groups";
import { EntryAmountField } from "@/features/transactions/entry-amount-field";
import { EntryClassificationFields } from "@/features/transactions/entry-classification-fields";
import { isBuiltKind } from "@/features/transactions/entry-kind";
import { EntryKindPicker } from "@/features/transactions/entry-kind-picker";
import type { EntryDraft, EntryKind } from "@/features/transactions/entry-kind";
import { PostingsEditor } from "@/features/transactions/postings-editor";
import { StatementChoice } from "@/features/transactions/statement-choice";
import { TagsField } from "@/features/transactions/tags-field";
import { useT } from "@/i18n/i18n-provider";
import { DateInput } from "@/ui/date-input";
import { FieldTitle } from "@/ui/field-title";
import { FormLayout } from "@/ui/form-layout";

type Account = components["schemas"]["Account"];
type Payee = components["schemas"]["Payee"];

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
  const simpleKind = draft.kind === "advanced" ? null : draft.kind;
  const accountLabel =
    draft.kind === "transfer"
      ? t("entry.from")
      : draft.kind === "income"
        ? t("entry.receiveIn")
        : t("entry.payWith");

  return (
    <FormLayout>
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

      {simpleKind !== null && (
        <EntryAmountField
          kind={simpleKind}
          value={draft.amount}
          currency={currency}
          scale={digits}
          error={error("amount")}
          autoFocus={autoFocusAmount}
          onChange={(amount) => {
            set({ amount });
          }}
        />
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
              set({ accountId: id, statement: null });
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
        <DateInput
          name="date"
          value={draft.date}
          onChange={(date) => {
            set({ date, statement: null });
          }}
        />
        {error("date") !== undefined && (
          <FieldError>{error("date")}</FieldError>
        )}
      </Field>

      {draft.kind === "expense" &&
        account !== undefined &&
        groupOf(account) === "cards" && (
          <StatementChoice
            cardId={account.id}
            date={draft.date}
            value={draft.statement}
            onChange={(statement) => {
              set({ statement });
            }}
          />
        )}

      {(draft.kind === "expense" || draft.kind === "income") && (
        <EntryClassificationFields
          kind={draft.kind}
          categoryId={draft.categoryId}
          payeeId={draft.payeeId}
          payees={payees}
          errors={errors}
          onCategory={(id) => {
            set({ categoryId: id });
          }}
          onPayee={(id) => {
            set({ payeeId: id });
          }}
        />
      )}

      {draft.kind === "advanced" && (
        <Field>
          <FieldTitle
            label={t("detail.postings")}
            help={t("detail.postingsHelp")}
          />
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
        <FieldTitle label={t("facts.tags")} help={t("facts.tagsHelp")} />
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
    </FormLayout>
  );
}
