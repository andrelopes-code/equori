import { IconButton } from "@slotted/react/button";
import { Field } from "@slotted/react/field";
import { Glyph, Icon } from "@slotted/react/icon";
import { Inline } from "@slotted/react/inline";
import { Switch } from "@slotted/react/switch";

import { RateField } from "@/features/calculators/fields/rate-field";
import type { Security } from "@/features/calculators/indexer-comparison/security";
import {
  choiceValue,
  indexChoices,
  securityChoice,
  type DraftSecurity,
} from "@/features/calculators/indexer-comparison/security-draft";
import { indexName } from "@/features/calculators/rate-source/index-catalog";
import { useT } from "@/i18n/i18n-provider";
import { ChoiceSelect } from "@/ui/form-fields/choice-select";
import { FieldTitle } from "@/ui/form-fields/field-title";

interface SecurityFieldsProps {
  // The position of the row, from 1.
  position: number;
  draft: DraftSecurity;
  security: Security;
  offered: readonly { id: string; period: "day" | "month" }[];
  removable: boolean;
  onChange: (patch: Partial<Omit<DraftSecurity, "key">>) => void;
  onRemove: () => void;
}

// One security: its indexer, its rate, whether its yield is tax-exempt, and the remove button of
// a row past the second.
export function SecurityFields({
  position,
  draft,
  security,
  offered,
  removable,
  onChange,
  onRemove,
}: SecurityFieldsProps) {
  const t = useT();
  const choices = [
    { value: "fixed", label: t("calc.indexerComparison.form.fixed") },
    ...indexChoices(offered).map((c) => ({
      value: choiceValue(c),
      label: t(
        c.form === "percent"
          ? "calc.indexerComparison.form.percent"
          : "calc.indexerComparison.form.spread",
        { index: indexName(c.index) },
      ),
    })),
  ];

  return (
    <Inline
      gap={3}
      align="end"
      wrap="nowrap"
      role="group"
      aria-label={t("calc.indexerComparison.security", { n: position })}
    >
      <Field necessity="none">
        <FieldTitle
          label={t("calc.indexerComparison.form")}
          help={t("calc.indexerComparison.indexer.help")}
        />
        <ChoiceSelect
          label={t("calc.indexerComparison.form")}
          choices={choices}
          value={securityChoice(security)}
          multiple={false}
          onChange={(next) => {
            if (typeof next === "string") onChange({ choice: next });
          }}
        />
      </Field>
      <RateField
        label={t("calc.indexerComparison.rate")}
        name={`rate-${String(draft.key)}`}
        value={draft.rate}
        onChange={(rate) => {
          onChange({ rate });
        }}
      />
      <Switch
        size="sm"
        aria-label={t("calc.indexerComparison.exempt.of", { n: position })}
        checked={!draft.taxed}
        onCheckedChange={(exempt) => {
          onChange({ taxed: !exempt });
        }}
      >
        {t("calc.indexerComparison.exempt")}
      </Switch>
      {removable && (
        <IconButton
          size="sm"
          variant="ghost"
          tone="secondary"
          aria-label={t("calc.indexerComparison.remove", { n: position })}
          onClick={onRemove}
        >
          <Icon>
            <Glyph name="trash" />
          </Icon>
        </IconButton>
      )}
    </Inline>
  );
}
