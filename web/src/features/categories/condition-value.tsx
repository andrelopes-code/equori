import { CurrencyField } from "@slotted/react/currency-field";
import { EntityPicker } from "@slotted/react/entity-picker";
import { Inline } from "@slotted/react/inline";
import { NumberField } from "@slotted/react/number-field";
import { Switch } from "@slotted/react/switch";
import { TextField } from "@slotted/react/text-field";

import type { components } from "@/api/schema.gen";
import { ChoiceSelect } from "@/ui/choice-select";
import type { Choice } from "@/ui/choice-select";
import type { RuleCondition } from "@/features/categories/rule-draft";
import type { MessageKey } from "@/i18n/catalog.en";
import { useT } from "@/i18n/i18n-provider";
import { majorFromMinor, minorFromMajor } from "@/ui/money-units";

type Money = components["schemas"]["Money"];

const kinds = [
  "checking",
  "savings",
  "cash",
  "wallet",
  "benefit",
  "reserve",
  "brokerage",
  "receivable",
  "credit_card",
  "loan",
  "payable",
];
const origins = ["manual", "import", "schedule"];
const weekdays = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];
const days = Array.from({ length: 31 }, (_, i) => String(i + 1));

function isMoney(value: unknown): value is Money {
  return typeof value === "object" && value !== null && "amount" in value;
}

// The value control of one condition, typed by its field and operator (A21).
export function ConditionValue({
  condition,
  onChange,
  payees,
  accounts,
  currency,
  scale,
  invalid,
}: {
  condition: RuleCondition;
  onChange: (value: unknown) => void;
  payees: readonly Choice[];
  accounts: readonly Choice[];
  currency: string;
  scale: number;
  invalid: boolean;
}) {
  const t = useT();
  const { field, operator, value } = condition;
  const list = operator === "in_list";
  const label = t("ruleEditor.value");

  const choicesOf = (values: string[], prefix: string): Choice[] =>
    values.map((v) => ({ value: v, label: t(`${prefix}.${v}` as MessageKey) }));

  switch (field) {
    case "description":
    case "raw_description":
      return list ? (
        <EntityPicker
          aria-label={label}
          selectionMode="multiple"
          overflow="wrap"
          media="none"
          items={((value as string[] | null) ?? []).map((v) => ({
            id: v,
            label: v,
            avatar: null,
          }))}
          value={(value as string[] | null) ?? []}
          invalid={invalid}
          onValueChange={(next) => {
            onChange([...next]);
          }}
          onCreate={(query) => {
            const text = query.trim();
            return text === "" ? null : { id: text, label: text, avatar: null };
          }}
          messages={{ create: t("ruleEditor.addText") }}
        />
      ) : (
        <TextField
          aria-label={label}
          value={typeof value === "string" ? value : ""}
          maxLength={200}
          invalid={invalid}
          mono={operator === "regex"}
          {...(operator === "regex"
            ? { placeholder: t("ruleEditor.regexPlaceholder") }
            : {})}
          onChange={(event) => {
            onChange(event.target.value);
          }}
        />
      );
    case "payee":
    case "account": {
      const items = (field === "payee" ? payees : accounts).map((c) => ({
        id: c.value,
        label: c.label,
        avatar: null,
      }));
      return list ? (
        <EntityPicker
          aria-label={label}
          selectionMode="multiple"
          overflow="wrap"
          media="none"
          openOn="focus"
          items={items}
          value={(value as string[] | null) ?? []}
          invalid={invalid}
          onValueChange={(next) => {
            onChange([...next]);
          }}
        />
      ) : (
        <EntityPicker
          aria-label={label}
          media="none"
          openOn="focus"
          items={items}
          value={typeof value === "string" ? value : null}
          invalid={invalid}
          onValueChange={(next) => {
            onChange(next);
          }}
        />
      );
    }
    case "account_kind":
    case "source":
    case "weekday": {
      const choices =
        field === "account_kind"
          ? choicesOf(kinds, "kind")
          : field === "source"
            ? choicesOf(origins, "origin")
            : choicesOf(weekdays, "weekday");
      return (
        <ChoiceSelect
          label={label}
          choices={choices}
          multiple={list}
          invalid={invalid}
          value={value as string | string[] | null}
          onChange={(next) => {
            onChange(next ?? (list ? [] : null));
          }}
        />
      );
    }
    case "amount":
    case "absolute_amount": {
      const money = (v: unknown) =>
        isMoney(v) ? majorFromMinor(v.amount, scale) : null;
      const toMoney = (major: number | null): Money | null =>
        major === null
          ? null
          : { amount: minorFromMajor(major, scale), currency };
      const one = (
        v: unknown,
        set: (m: Money | null) => void,
        name: string,
      ) => (
        <CurrencyField
          aria-label={name}
          currency={currency}
          value={money(v)}
          invalid={invalid}
          format={{ signDisplay: field === "amount" ? "always" : "auto" }}
          onValueChange={(next: number | null) => {
            set(toMoney(next));
          }}
        />
      );
      if (operator === "between") {
        const pair = (value as unknown[] | null) ?? [null, null];
        return (
          <Inline gap={2} wrap="nowrap">
            {one(
              pair[0],
              (m) => {
                onChange([m, pair[1] ?? null]);
              },
              t("ruleEditor.from"),
            )}
            {one(
              pair[1],
              (m) => {
                onChange([pair[0] ?? null, m]);
              },
              t("ruleEditor.to"),
            )}
          </Inline>
        );
      }
      return one(value, onChange, label);
    }
    case "day_of_month": {
      if (list) {
        return (
          <ChoiceSelect
            label={label}
            choices={days.map((d) => ({ value: d, label: d }))}
            multiple
            invalid={invalid}
            value={((value as number[] | null) ?? []).map(String)}
            onChange={(next) => {
              onChange(((next as string[] | null) ?? []).map(Number));
            }}
          />
        );
      }
      const day = (
        v: unknown,
        set: (n: number | null) => void,
        name: string,
      ) => (
        <NumberField
          aria-label={name}
          min={1}
          max={31}
          value={typeof v === "number" ? v : null}
          invalid={invalid}
          onValueChange={(next: number | null) => {
            set(next);
          }}
        />
      );
      if (operator === "between") {
        const pair = (value as unknown[] | null) ?? [null, null];
        return (
          <Inline gap={2} wrap="nowrap">
            {day(
              pair[0],
              (n) => {
                onChange([n, pair[1] ?? null]);
              },
              t("ruleEditor.from"),
            )}
            {day(
              pair[1],
              (n) => {
                onChange([pair[0] ?? null, n]);
              },
              t("ruleEditor.to"),
            )}
          </Inline>
        );
      }
      return day(value, onChange, label);
    }
    case "installment":
      return (
        <Switch
          checked={value === true}
          onCheckedChange={(checked) => {
            onChange(checked);
          }}
        >
          {value === true
            ? t("rule.installment.yes")
            : t("rule.installment.no")}
        </Switch>
      );
  }
}
