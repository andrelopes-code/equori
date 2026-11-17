import { Field, FieldError, FieldLabel } from "@slotted/react/field";

import type { components } from "@/api/schema.gen";
import { AccountField } from "@/features/transactions/account-field/account-field";
import type {
  EntryDraft,
  PostingKind,
} from "@/features/transactions/entry-model/entry-kind";
import { EntryAmountField } from "@/features/transactions/transaction-form/entry-amount-field";
import { useT } from "@/i18n/i18n-provider";

type Account = components["schemas"]["Account"];

const accountLabelKey = {
  expense: "entry.payWith",
  income: "entry.receiveIn",
  transfer: "entry.from",
} as const;

export interface SimpleEntryFieldsProps {
  kind: Exclude<PostingKind, "advanced">;
  draft: EntryDraft;
  accounts: readonly Account[];
  currency: string;
  scale: (code: string) => number;
  errors: Record<string, string>;
  autoFocusAmount: boolean;
  onAmount: (amount: number) => void;
  onAccount: (id: string) => void;
  onTo: (id: string) => void;
}

// The amount of a simple entry, its account and, for a transfer, the account that receives.
export function SimpleEntryFields({
  kind,
  draft,
  accounts,
  currency,
  scale,
  errors,
  autoFocusAmount,
  onAmount,
  onAccount,
  onTo,
}: SimpleEntryFieldsProps) {
  const t = useT();

  const accountLabel = t(accountLabelKey[kind]);

  return (
    <>
      <EntryAmountField
        kind={kind}
        value={draft.amount}
        currency={currency}
        scale={scale(currency)}
        error={errors.amount}
        autoFocus={autoFocusAmount}
        onChange={onAmount}
      />

      <Field required invalid={errors.account !== undefined}>
        <FieldLabel>{accountLabel}</FieldLabel>
        <AccountField
          name="account"
          title={accountLabel}
          accounts={accounts}
          value={draft.accountId}
          exclude={kind === "transfer" ? draft.toAccountId : null}
          amount={draft.amount}
          direction={kind === "income" ? "in" : "out"}
          date={draft.date}
          categoryId={kind === "transfer" ? null : draft.categoryId}
          payeeId={kind === "transfer" ? null : draft.payeeId}
          kind={kind}
          currency={currency}
          scale={scale}
          onChange={onAccount}
        />
        {errors.account !== undefined && (
          <FieldError>{errors.account}</FieldError>
        )}
      </Field>

      {kind === "transfer" && (
        <Field required invalid={errors.to !== undefined}>
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
            onChange={onTo}
          />
          {errors.to !== undefined && <FieldError>{errors.to}</FieldError>}
        </Field>
      )}
    </>
  );
}
