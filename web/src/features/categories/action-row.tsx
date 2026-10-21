import { IconButton } from "@slotted/react/button";
import { EntityPicker } from "@slotted/react/entity-picker";
import { Glyph, Icon } from "@slotted/react/icon";
import { Text } from "@slotted/react/typography";

import { CategoryPicker } from "@/features/categories/category-picker";
import { ChoiceSelect } from "@/features/categories/choice-select";
import type { Choice } from "@/features/categories/choice-select";
import styles from "@/features/categories/action-row.module.css";
import { emptyAction } from "@/features/categories/rule-draft";
import type { RuleActionInput } from "@/features/categories/rule-draft";
import { SplitParts } from "@/features/categories/split-parts";
import type { MessageKey } from "@/i18n/catalog.en";
import { useT } from "@/i18n/i18n-provider";

const types: RuleActionInput["type"][] = [
  "set_category",
  "set_payee",
  "add_tags",
  "split",
  "transfer",
  "mark_reimbursable",
];

const tagPattern = /^[a-z0-9][a-z0-9-]{0,59}$/;

export function ActionRow({
  index,
  action,
  onChange,
  onRemove,
  canRemove,
  errors,
  payees,
  accounts,
  receivables,
  currency,
  scale,
}: {
  index: number;
  action: RuleActionInput;
  onChange: (action: RuleActionInput) => void;
  onRemove: () => void;
  canRemove: boolean;
  errors: Record<string, string>;
  payees: readonly Choice[];
  accounts: readonly Choice[];
  receivables: readonly Choice[];
  currency: string;
  scale: number;
}) {
  const t = useT();
  const at = `actions[${String(index)}]`;
  const error =
    errors[`${at}.category_id`] ??
    errors[`${at}.payee_id`] ??
    errors[`${at}.tags`] ??
    errors[`${at}.account_id`] ??
    errors[`${at}.parts`];
  const picker = (
    choices: readonly Choice[],
    value: string,
    set: (id: string) => void,
  ) => (
    <EntityPicker
      aria-label={t("ruleEditor.value")}
      media="none"
      openOn="focus"
      items={choices.map((c) => ({
        id: c.value,
        label: c.label,
        avatar: null,
      }))}
      value={value === "" ? null : value}
      invalid={error !== undefined}
      onValueChange={(next) => {
        set(next ?? "");
      }}
    />
  );

  let body;
  switch (action.type) {
    case "set_category":
      body = (
        <CategoryPicker
          aria-label={t("ruleEditor.value")}
          value={
            action.category_id === "" ? null : (action.category_id ?? null)
          }
          invalid={error !== undefined}
          onChange={(id) => {
            onChange({ type: action.type, category_id: id ?? "" });
          }}
        />
      );
      break;
    case "set_payee":
      body = picker(payees, action.payee_id ?? "", (id) => {
        onChange({ type: action.type, payee_id: id });
      });
      break;
    case "transfer":
      body = picker(accounts, action.account_id ?? "", (id) => {
        onChange({ type: action.type, account_id: id });
      });
      break;
    case "mark_reimbursable":
      body = picker(receivables, action.account_id ?? "", (id) => {
        onChange({ type: action.type, account_id: id });
      });
      break;
    case "add_tags":
      body = (
        <EntityPicker
          aria-label={t("ruleEditor.tags")}
          selectionMode="multiple"
          overflow="wrap"
          media="none"
          items={(action.tags ?? []).map((tag) => ({
            id: tag,
            label: tag,
            avatar: null,
          }))}
          value={action.tags ?? []}
          invalid={error !== undefined}
          onValueChange={(next) => {
            onChange({ type: action.type, tags: [...next] });
          }}
          onCreate={(query) => {
            const tag = query.trim().toLowerCase().replace(/\s+/g, "-");
            return tagPattern.test(tag)
              ? { id: tag, label: tag, avatar: null }
              : null;
          }}
          messages={{ create: t("tags.create") }}
        />
      );
      break;
    case "split":
      body = (
        <SplitParts
          parts={action.parts ?? []}
          onChange={(parts) => {
            onChange({ type: action.type, parts });
          }}
          currency={currency}
          scale={scale}
          errors={errors}
          at={at}
        />
      );
      break;
  }

  return (
    <div className={styles.row}>
      <div className={styles.type}>
        <ChoiceSelect
          label={t("ruleEditor.actionType", { index: index + 1 })}
          multiple={false}
          choices={types.map((type) => ({
            value: type,
            label: t(`action.type.${type}` as MessageKey),
          }))}
          value={action.type}
          onChange={(value) => {
            const type = types.find((candidate) => candidate === value);
            if (type !== undefined && type !== action.type)
              onChange(emptyAction(type));
          }}
        />
      </div>
      <div className={styles.body}>{body}</div>
      <div className={styles.remove}>
        <IconButton
          aria-label={t("ruleEditor.removeAction", { index: index + 1 })}
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
      {error !== undefined && (
        <Text size="sm" tone="danger" className={styles.message}>
          {error}
        </Text>
      )}
    </div>
  );
}
