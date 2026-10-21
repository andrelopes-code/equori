import { IconButton } from "@slotted/react/button";
import { Glyph, Icon } from "@slotted/react/icon";
import { Text } from "@slotted/react/typography";

import { ChoiceSelect } from "@/features/categories/choice-select";
import type { Choice } from "@/features/categories/choice-select";
import { ConditionValue } from "@/features/categories/condition-value";
import styles from "@/features/categories/condition-row.module.css";
import {
  conditionFields,
  operatorsFor,
  withField,
  withOperator,
} from "@/features/categories/rule-draft";
import type { RuleCondition } from "@/features/categories/rule-draft";
import type { MessageKey } from "@/i18n/catalog.en";
import { useT } from "@/i18n/i18n-provider";

// BD-05: field, comparison and value on one line where the builder has room; narrower, the
// field takes its own line and the other two share the next.
export function ConditionRow({
  index,
  condition,
  onChange,
  onRemove,
  canRemove,
  error,
  payees,
  accounts,
  currency,
  scale,
}: {
  index: number;
  condition: RuleCondition;
  onChange: (condition: RuleCondition) => void;
  onRemove: () => void;
  canRemove: boolean;
  error: string | undefined;
  payees: readonly Choice[];
  accounts: readonly Choice[];
  currency: string;
  scale: number;
}) {
  const t = useT();
  const fields: Choice[] = conditionFields.map((f) => ({
    value: f,
    label: t(`rule.field.${f}` as MessageKey),
  }));
  const operators: Choice[] = operatorsFor(condition.field).map((o) => ({
    value: o,
    label: t(`rule.op.${o}` as MessageKey),
  }));
  // What the value means where it is not obvious: the sign of an amount, a pattern's syntax.
  const hint =
    condition.field === "amount"
      ? t("ruleEditor.amountHint")
      : condition.operator === "regex"
        ? t("ruleEditor.regexHint")
        : undefined;
  return (
    <div
      className={styles.row}
      data-invalid={error === undefined ? undefined : ""}
    >
      <div className={styles.field}>
        <ChoiceSelect
          label={t("ruleEditor.field", { index: index + 1 })}
          choices={fields}
          multiple={false}
          value={condition.field}
          onChange={(value) => {
            const field = conditionFields.find((f) => f === value);
            if (field !== undefined) onChange(withField(condition, field));
          }}
        />
      </div>
      <div className={styles.operator}>
        {condition.field === "installment" ? null : (
          <ChoiceSelect
            label={t("ruleEditor.operator", { index: index + 1 })}
            choices={operators}
            multiple={false}
            value={condition.operator}
            onChange={(value) => {
              const operator = operatorsFor(condition.field).find(
                (o) => o === value,
              );
              if (operator !== undefined)
                onChange(withOperator(condition, operator));
            }}
          />
        )}
      </div>
      <div className={styles.value}>
        <ConditionValue
          condition={condition}
          onChange={(value) => {
            onChange({ ...condition, value });
          }}
          payees={payees}
          accounts={accounts}
          currency={currency}
          scale={scale}
          invalid={error !== undefined}
        />
      </div>
      <div className={styles.remove}>
        <IconButton
          aria-label={t("ruleEditor.removeCondition", { index: index + 1 })}
          variant="ghost"
          tone="secondary"
          disabled={!canRemove}
          onClick={onRemove}
        >
          <Icon>
            <Glyph name="x" />
          </Icon>
        </IconButton>
      </div>
      {(error !== undefined || hint !== undefined) && (
        <Text
          size="sm"
          tone={error === undefined ? "muted" : "danger"}
          className={styles.message}
        >
          {error ?? hint}
        </Text>
      )}
    </div>
  );
}
