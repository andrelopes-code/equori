import { Button } from "@slotted/react/button";
import type { Entity } from "@slotted/react/entity-picker";
import { Segment, SegmentedControl } from "@slotted/react/segmented-control";
import type { Dispatch } from "react";

import type { components } from "@/api/schema.gen";
import { AmountField } from "@/features/transactions/amount-field";
import { EntityField } from "@/features/transactions/entity-field";
import { PostingsEditor } from "@/features/transactions/postings-editor";
import { SplitEditor } from "@/features/transactions/split-editor";
import { TransactionMetaFields } from "@/features/transactions/transaction-meta-fields";
import type {
  FormAction,
  FormState,
  Mode,
} from "@/features/transactions/transaction-form-reducer";
import { useT } from "@/i18n/i18n-provider";

function isMode(value: string): value is Mode {
  return value === "expense" || value === "income" || value === "transfer";
}

// Every field of a transaction form: quick entry or free postings, then date, payee, description and tags.
export function TransactionFields({
  state,
  dispatch,
  accounts,
  payees,
  baseCurrency,
  scale,
  currencyOf,
  errors,
  canQuick = true,
}: {
  state: FormState;
  dispatch: Dispatch<FormAction>;
  accounts: components["schemas"]["Account"][];
  payees: components["schemas"]["Payee"][];
  baseCurrency: string;
  scale: (code: string) => number;
  currencyOf: (accountId: string) => string;
  errors: {
    amount?: string | undefined;
    date?: string | undefined;
    description?: string | undefined;
  };
  canQuick?: boolean;
}) {
  const t = useT();
  const open = accounts.filter((a) => a.closed_on === undefined);
  const toEntity = (a: { id: string; name: string }): Entity => ({
    id: a.id,
    label: a.name,
  });
  const balanceAccounts = open
    .filter((a) => a.class === "asset" || a.class === "liability")
    .map(toEntity);
  const categoryClass = state.mode === "income" ? "income" : "expense";
  const counters =
    state.mode === "transfer"
      ? balanceAccounts.filter((a) => a.id !== state.accountId)
      : open.filter((a) => a.class === categoryClass).map(toEntity);
  const currency = currencyOf(state.accountId);
  const transfer = state.mode === "transfer";

  return (
    <>
      {state.postings === null ? (
        <>
          <SegmentedControl
            aria-label={t("transactions.new.mode")}
            value={state.mode}
            fullWidth
            onValueChange={(mode) => {
              if (isMode(mode)) dispatch({ type: "mode", mode });
            }}
          >
            <Segment value="expense">{t("transactions.new.expense")}</Segment>
            <Segment value="income">{t("transactions.new.income")}</Segment>
            <Segment value="transfer">{t("transactions.new.transfer")}</Segment>
          </SegmentedControl>
          <AmountField
            label={t("transactions.new.amount")}
            currency={currency}
            scale={scale(currency)}
            value={state.amount}
            error={errors.amount}
            onChange={(amount) => {
              dispatch({ type: "amount", amount });
            }}
          />
          <EntityField
            label={t(
              transfer ? "transactions.new.from" : "transactions.new.account",
            )}
            kind="account"
            entities={balanceAccounts}
            value={state.accountId}
            onChange={(id) => {
              dispatch({ type: "account", id });
            }}
          />
          {state.split === null ? (
            <>
              <EntityField
                label={t(
                  transfer
                    ? "transactions.new.to"
                    : "transactions.new.category",
                )}
                kind={transfer ? "account" : "category"}
                entities={counters}
                value={state.counterId}
                onChange={(id) => {
                  dispatch({ type: "counter", id });
                }}
              />
              {!transfer && (
                <Button
                  type="button"
                  tone="secondary"
                  variant="ghost"
                  onClick={() => {
                    dispatch({ type: "split" });
                  }}
                >
                  {t("transactions.new.split")}
                </Button>
              )}
            </>
          ) : (
            <SplitEditor
              state={state}
              dispatch={dispatch}
              categories={counters}
              currency={currency}
              scale={scale(currency)}
            />
          )}
        </>
      ) : (
        <PostingsEditor
          postings={state.postings}
          dispatch={dispatch}
          accounts={open.map(toEntity)}
          currencyOf={currencyOf}
          baseCurrency={baseCurrency}
          scale={scale}
          error={errors.amount}
          canQuick={canQuick}
        />
      )}
      <TransactionMetaFields
        state={state}
        dispatch={dispatch}
        payees={payees}
        errors={errors}
      />
      {state.postings === null && (
        <Button
          type="button"
          tone="secondary"
          variant="ghost"
          onClick={() => {
            dispatch({ type: "advanced", currencyOf });
          }}
        >
          {t("transactions.new.advanced")}
        </Button>
      )}
    </>
  );
}
