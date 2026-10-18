import type { Entity } from "@slotted/react/entity-picker";
import {
  Field,
  FieldDefaultsProvider,
  FieldError,
  FieldLabel,
} from "@slotted/react/field";
import type { Dispatch } from "react";

import type { components } from "@/api/schema.gen";
import { AmountEntry } from "@/features/transactions/amount-entry";
import { PostingsEditor } from "@/features/transactions/postings-editor";
import { SplitEditor } from "@/features/transactions/split-editor";
import { TransactionMetaFields } from "@/features/transactions/transaction-meta-fields";
import type {
  FormAction,
  FormState,
} from "@/features/transactions/transaction-form-reducer";
import styles from "@/features/transactions/transaction-fields.module.css";
import { useT } from "@/i18n/i18n-provider";
import { ChoiceChips } from "@/ui/choice-chips";
import { TextSwitch } from "@/ui/text-switch";
import { useViewport } from "@/ui/use-viewport";

// Every field of a transaction form (complete frontend F1), as an entry sheet: the kind as words,
// the amount as the headline figure, the accounts and categories as words to tap, then date,
// payee, description and tags. Labels stand beside the controls from 600 px.
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
  const phone = useViewport() === "phone";
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

  const choices = (entities: Entity[]) =>
    entities.map((entity) => ({ id: entity.id, name: entity.label }));

  return (
    <FieldDefaultsProvider labelPlacement={phone ? "top" : "side"}>
      <div data-own="entry-sheet" className={styles.sheet}>
        {state.postings === null ? (
          <>
            <TextSwitch
              label={t("transactions.new.mode")}
              options={[
                { value: "expense", label: t("transactions.new.expense") },
                { value: "income", label: t("transactions.new.income") },
                { value: "transfer", label: t("transactions.new.transfer") },
              ]}
              value={state.mode}
              onChange={(mode) => {
                dispatch({ type: "mode", mode });
              }}
            />
            <Field invalid={errors.amount !== undefined}>
              <FieldLabel>{t("transactions.new.amount")}</FieldLabel>
              <AmountEntry
                currency={currency}
                scale={scale(currency)}
                value={state.amount}
                onChange={(amount) => {
                  dispatch({ type: "amount", amount });
                }}
              />
              {errors.amount !== undefined && (
                <FieldError>{errors.amount}</FieldError>
              )}
            </Field>
            <Field>
              <FieldLabel>
                {t(
                  transfer
                    ? "transactions.new.from"
                    : "transactions.new.account",
                )}
              </FieldLabel>
              <ChoiceChips
                choices={choices(balanceAccounts)}
                value={state.accountId}
                onChange={(id) => {
                  dispatch({ type: "account", id });
                }}
              />
            </Field>
            {state.split === null ? (
              <Field>
                <FieldLabel>
                  {t(
                    transfer
                      ? "transactions.new.to"
                      : "transactions.new.category",
                  )}
                </FieldLabel>
                <div className={styles.choices}>
                  <ChoiceChips
                    choices={choices(counters)}
                    value={state.counterId}
                    onChange={(id) => {
                      dispatch({ type: "counter", id });
                    }}
                  />
                  {!transfer && (
                    <button
                      type="button"
                      className={styles.aside}
                      onClick={() => {
                        dispatch({ type: "split" });
                      }}
                    >
                      {t("transactions.new.split")}
                    </button>
                  )}
                </div>
              </Field>
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
          <button
            type="button"
            className={styles.aside}
            onClick={() => {
              dispatch({ type: "advanced", currencyOf });
            }}
          >
            {t("transactions.new.advanced")}
          </button>
        )}
      </div>
    </FieldDefaultsProvider>
  );
}
