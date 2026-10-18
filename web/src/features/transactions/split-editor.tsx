import { Button, IconButton } from "@slotted/react/button";
import type { Entity } from "@slotted/react/entity-picker";
import { List } from "@slotted/react/list";
import { ListItem } from "@slotted/react/list-item";
import type { Dispatch } from "react";

import { AmountField } from "@/features/transactions/amount-field";
import { EntityField } from "@/features/transactions/entity-field";
import styles from "@/features/transactions/new-transaction-page.module.css";
import { splitRemainder } from "@/features/transactions/transaction-form-reducer";
import type {
  FormAction,
  FormState,
} from "@/features/transactions/transaction-form-reducer";
import { useT } from "@/i18n/i18n-provider";
import { IconGlyph } from "@/ui/icon-glyph";
import { MoneyText } from "@/ui/money-text";

// Category lines that together take the transaction amount; the remainder is what no line holds yet.
export function SplitEditor({
  state,
  dispatch,
  categories,
  currency,
  scale,
  minLines = 2,
  canUnsplit = true,
}: {
  state: FormState;
  dispatch: Dispatch<FormAction>;
  categories: Entity[];
  currency: string;
  scale: number;
  minLines?: number;
  canUnsplit?: boolean;
}) {
  const t = useT();
  const lines = state.split ?? [];
  return (
    <div className={styles.editor}>
      <List variant="ruled" aria-label={t("transactions.new.splitLines")}>
        {lines.map((line, index) => {
          const n = String(index + 1);
          return (
            <ListItem key={line.key}>
              <div className={styles.line}>
                <EntityField
                  label={t("transactions.new.splitCategory", { n })}
                  kind="category"
                  entities={categories}
                  value={line.categoryId}
                  onChange={(id) => {
                    dispatch({ type: "splitCategory", key: line.key, id });
                  }}
                />
                <AmountField
                  label={t("transactions.new.splitAmount", { n })}
                  currency={currency}
                  scale={scale}
                  value={line.amount}
                  error={undefined}
                  onChange={(amount) => {
                    dispatch({ type: "splitAmount", key: line.key, amount });
                  }}
                />
                <IconButton
                  aria-label={t("transactions.new.splitRemove", { n })}
                  tone="secondary"
                  variant="ghost"
                  disabled={lines.length <= minLines}
                  onClick={() => {
                    dispatch({ type: "splitRemove", key: line.key });
                  }}
                >
                  <IconGlyph name="close" />
                </IconButton>
              </div>
            </ListItem>
          );
        })}
      </List>
      <div className={styles.summary}>
        <span>{t("transactions.new.splitRemainder")}</span>
        <MoneyText
          money={{ amount: splitRemainder(state), currency }}
          scale={scale}
          tone="balance"
        />
      </div>
      <div className={styles.editorActions}>
        <Button
          type="button"
          tone="secondary"
          variant="outline"
          onClick={() => {
            dispatch({ type: "splitAdd" });
          }}
        >
          {t("transactions.new.splitAdd")}
        </Button>
        {canUnsplit && (
          <Button
            type="button"
            tone="secondary"
            variant="ghost"
            onClick={() => {
              dispatch({ type: "quick" });
            }}
          >
            {t("transactions.new.unsplit")}
          </Button>
        )}
      </div>
    </div>
  );
}
