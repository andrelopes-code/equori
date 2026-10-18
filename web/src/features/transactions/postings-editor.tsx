import { Button, IconButton } from "@slotted/react/button";
import type { Entity } from "@slotted/react/entity-picker";
import { Field, FieldLabel } from "@slotted/react/field";
import { List } from "@slotted/react/list";
import { ListItem } from "@slotted/react/list-item";
import { TextField } from "@slotted/react/text-field";
import type { Dispatch } from "react";

import { AmountField } from "@/features/transactions/amount-field";
import { EntityField } from "@/features/transactions/entity-field";
import styles from "@/features/transactions/new-transaction-page.module.css";
import { postingImbalance } from "@/features/transactions/transaction-form-reducer";
import type {
  FormAction,
  PostingLine,
} from "@/features/transactions/transaction-form-reducer";
import { useT } from "@/i18n/i18n-provider";
import { IconGlyph } from "@/ui/icon-glyph";
import { MoneyText } from "@/ui/money-text";

// Free postings: any account, a signed amount per line, balanced per currency.
export function PostingsEditor({
  postings,
  dispatch,
  accounts,
  currencyOf,
  baseCurrency,
  scale,
  error,
  canQuick = true,
}: {
  postings: PostingLine[];
  dispatch: Dispatch<FormAction>;
  accounts: Entity[];
  currencyOf: (accountId: string) => string;
  baseCurrency: string;
  scale: (code: string) => number;
  error: string | undefined;
  canQuick?: boolean;
}) {
  const t = useT();
  const imbalance = Object.entries(postingImbalance(postings));
  return (
    <div className={styles.editor}>
      <List variant="ruled" aria-label={t("transactions.new.postings")}>
        {postings.map((line, index) => {
          const n = String(index + 1);
          return (
            <ListItem key={line.key}>
              <div className={styles.line}>
                <EntityField
                  label={t("transactions.new.postingAccount", { n })}
                  kind="account"
                  entities={accounts}
                  value={line.accountId}
                  onChange={(id) => {
                    dispatch({
                      type: "postingAccount",
                      key: line.key,
                      id,
                      currency: id === "" ? baseCurrency : currencyOf(id),
                      scale,
                    });
                  }}
                />
                <AmountField
                  signed
                  label={t("transactions.new.postingAmount", { n })}
                  currency={line.currency}
                  scale={scale(line.currency)}
                  value={line.amount}
                  error={undefined}
                  onChange={(amount) => {
                    dispatch({ type: "postingAmount", key: line.key, amount });
                  }}
                />
                <Field>
                  <FieldLabel>
                    {t("transactions.new.postingMemo", { n })}
                  </FieldLabel>
                  <TextField
                    value={line.memo}
                    onValueChange={(memo) => {
                      dispatch({ type: "postingMemo", key: line.key, memo });
                    }}
                  />
                </Field>
                <IconButton
                  aria-label={t("transactions.new.postingRemove", { n })}
                  tone="secondary"
                  variant="ghost"
                  disabled={postings.length <= 2}
                  onClick={() => {
                    dispatch({ type: "postingRemove", key: line.key });
                  }}
                >
                  <IconGlyph name="close" />
                </IconButton>
              </div>
            </ListItem>
          );
        })}
      </List>
      {imbalance.map(([currency, amount]) => (
        <div className={styles.summary} key={currency}>
          <span>{t("transactions.new.imbalance")}</span>
          <MoneyText
            money={{ amount, currency }}
            scale={scale(currency)}
            tone="balance"
          />
        </div>
      ))}
      {error !== undefined && (
        <div className={styles.summary} role="alert">
          {error}
        </div>
      )}
      <div className={styles.editorActions}>
        <Button
          type="button"
          tone="secondary"
          variant="outline"
          onClick={() => {
            dispatch({ type: "postingAdd", currency: baseCurrency });
          }}
        >
          {t("transactions.new.postingAdd")}
        </Button>
        {canQuick && (
          <Button
            type="button"
            tone="secondary"
            variant="ghost"
            onClick={() => {
              dispatch({ type: "quick" });
            }}
          >
            {t("transactions.new.quick")}
          </Button>
        )}
      </div>
    </div>
  );
}
