import type { ReactNode } from "react";

import type { components } from "@/api/schema.gen";
import { groupOf } from "@/features/transactions/model/account-groups";
import { BaseAmountField } from "@/features/transactions/transaction-form/base-amount-field";
import { EntryClassificationFields } from "@/features/transactions/transaction-form/entry-classification-fields";
import { EntryDateField } from "@/features/transactions/transaction-form/entry-date-field";
import { EntryDetailFields } from "@/features/transactions/transaction-form/entry-detail-fields";
import { isBuiltKind } from "@/features/transactions/entry-model/entry-kind";
import { EntryKindPicker } from "@/features/transactions/entry-kind-picker/entry-kind-picker";
import type {
  EntryDraft,
  EntryKind,
} from "@/features/transactions/entry-model/entry-kind";
import { PostingsField } from "@/features/transactions/transaction-form/postings-field";
import { SimpleEntryFields } from "@/features/transactions/transaction-form/simple-entry-fields";
import { StatementChoice } from "@/features/transactions/transaction-form/statement-choice";
import { FormLayout } from "@/ui/form-layout/form-layout";

type Account = components["schemas"]["Account"];
type Payee = components["schemas"]["Payee"];

export interface TransactionFormProps {
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
}: TransactionFormProps) {
  const account =
    draft.accountId === null
      ? undefined
      : accounts.find((a) => a.id === draft.accountId);
  const currency = account?.currency ?? baseCurrency;
  const simpleKind = draft.kind === "advanced" ? null : draft.kind;

  const set = (patch: Partial<EntryDraft>) => {
    onChange({ ...draft, ...patch });
  };

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
        <SimpleEntryFields
          kind={simpleKind}
          draft={draft}
          accounts={accounts}
          currency={currency}
          scale={scale}
          errors={errors}
          autoFocusAmount={autoFocusAmount}
          onAmount={(amount) => {
            set({ amount });
          }}
          onAccount={(id) => {
            // The value in the base currency belongs to the account's currency.
            set({
              accountId: id,
              statement: null,
              baseAmount: 0,
              baseAmountTyped: false,
            });
          }}
          onTo={(id) => {
            set({ toAccountId: id });
          }}
        />
      )}

      <EntryDateField
        value={draft.date}
        error={errors.date}
        onChange={(date) => {
          set({ date, statement: null });
        }}
      />

      <BaseAmountField
        account={simpleKind === null ? undefined : account}
        baseCurrency={baseCurrency}
        scale={scale}
        amount={draft.amount}
        date={draft.date}
        value={draft.baseAmount ?? 0}
        typed={draft.baseAmountTyped ?? false}
        error={errors.baseAmount}
        onChange={(baseAmount, baseAmountTyped) => {
          set({ baseAmount, baseAmountTyped });
        }}
      />

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
        <PostingsField
          rows={draft.rows}
          onChange={(rows) => {
            set({ rows });
          }}
          accounts={accounts}
          baseCurrency={baseCurrency}
          scale={scale}
          errors={errors}
        />
      )}

      <EntryDetailFields
        description={draft.description}
        value={draft.tags}
        tags={tags}
        errors={errors}
        onDescription={(description) => {
          set({ description });
        }}
        onTags={(value) => {
          set({ tags: value });
        }}
      />

      {children}
    </FormLayout>
  );
}
