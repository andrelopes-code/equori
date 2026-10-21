import { Button, IconButton } from "@slotted/react/button";
import { CurrencyField } from "@slotted/react/currency-field";
import { Glyph, Icon } from "@slotted/react/icon";
import { NumberField } from "@slotted/react/number-field";
import { Stack } from "@slotted/react/stack";

import type { components } from "@/api/schema.gen";
import { CategoryPicker } from "@/features/categories/category-picker";
import { ChoiceSelect } from "@/features/categories/choice-select";
import styles from "@/features/categories/split-parts.module.css";
import { limits } from "@/features/categories/rule-draft";
import { useT } from "@/i18n/i18n-provider";
import { majorFromMinor, minorFromMajor } from "@/ui/money-units";

type Part = components["schemas"]["RuleSplitPart"];
type Mode = "percent" | "amount" | "remainder";

function modeOf(part: Part): Mode {
  if (part.remainder === true) return "remainder";
  if (part.amount !== undefined) return "amount";
  return "percent";
}

// A split rule's parts: a share in percent (basis points on the wire), a fixed amount, or the rest.
export function SplitParts({
  parts,
  onChange,
  currency,
  scale,
  errors,
  at,
}: {
  parts: readonly Part[];
  onChange: (parts: Part[]) => void;
  currency: string;
  scale: number;
  errors: Record<string, string>;
  // The action's path, for the error keys of its parts.
  at: string;
}) {
  const t = useT();
  const set = (index: number, part: Part) => {
    onChange(parts.map((p, i) => (i === index ? part : p)));
  };
  return (
    <Stack gap={2}>
      {parts.map((part, index) => {
        const mode = modeOf(part);
        const label = (
          key:
            "ruleEditor.part" | "ruleEditor.partMode" | "ruleEditor.partValue",
        ) => t(key, { index: index + 1 });
        return (
          <div key={index} className={styles.row}>
            <CategoryPicker
              aria-label={label("ruleEditor.part")}
              value={part.category_id === "" ? null : part.category_id}
              invalid={
                errors[`${at}.parts[${String(index)}].category_id`] !==
                undefined
              }
              onChange={(id) => {
                set(index, { ...part, category_id: id ?? "" });
              }}
            />
            <ChoiceSelect
              label={label("ruleEditor.partMode")}
              multiple={false}
              choices={[
                { value: "percent", label: t("ruleEditor.mode.percent") },
                { value: "amount", label: t("ruleEditor.mode.amount") },
                { value: "remainder", label: t("ruleEditor.mode.remainder") },
              ]}
              value={mode}
              onChange={(value) => {
                const base = { category_id: part.category_id };
                if (value === "remainder")
                  set(index, { ...base, remainder: true });
                else if (value === "amount")
                  set(index, { ...base, amount: { amount: 0, currency } });
                else set(index, { ...base, percent: 5000 });
              }}
            />
            {mode === "percent" && (
              <NumberField
                aria-label={label("ruleEditor.partValue")}
                min={0.01}
                max={99.99}
                step={1}
                value={majorFromMinor(part.percent ?? 0, 2)}
                onValueChange={(value: number | null) => {
                  set(index, {
                    category_id: part.category_id,
                    percent: minorFromMajor(value ?? 0, 2),
                  });
                }}
              />
            )}
            {mode === "amount" && (
              <CurrencyField
                aria-label={label("ruleEditor.partValue")}
                currency={currency}
                value={majorFromMinor(part.amount?.amount ?? 0, scale)}
                onValueChange={(value: number | null) => {
                  set(index, {
                    category_id: part.category_id,
                    amount: {
                      amount: minorFromMajor(value ?? 0, scale),
                      currency,
                    },
                  });
                }}
              />
            )}
            {mode === "remainder" && <span />}
            <IconButton
              aria-label={t("ruleEditor.removePart", { index: index + 1 })}
              variant="ghost"
              tone="secondary"
              disabled={parts.length <= 2}
              onClick={() => {
                onChange(parts.filter((_, i) => i !== index));
              }}
            >
              <Icon>
                <Glyph name="x" />
              </Icon>
            </IconButton>
          </div>
        );
      })}
      <div>
        <Button
          size="sm"
          variant="ghost"
          tone="secondary"
          disabled={parts.length >= limits.parts}
          start={
            <Icon size="sm">
              <Glyph name="plus" />
            </Icon>
          }
          onClick={() => {
            onChange([...parts, { category_id: "", percent: 1000 }]);
          }}
        >
          {t("ruleEditor.addPart")}
        </Button>
      </div>
    </Stack>
  );
}
