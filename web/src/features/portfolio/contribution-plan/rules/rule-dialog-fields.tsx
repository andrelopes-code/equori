import { Checkbox } from "@slotted/react/checkbox";
import { CheckboxGroup } from "@slotted/react/checkbox-group";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@slotted/react/field";
import { NumberField } from "@slotted/react/number-field";
import { useQuery } from "@tanstack/react-query";

import { useApi } from "@/api/api-context";
import type { components } from "@/api/schema.gen";
import {
  instrumentTypes,
  subtypeLabel,
  subtypesQuery,
  typeLabel,
} from "@/features/instruments";
import { RuleChoice } from "@/features/portfolio/contribution-plan/rules/rule-choice";
import {
  kindLabel,
  kinds,
  takesKind,
} from "@/features/portfolio/contribution-plan/rules/rule-form";
import type { useRuleDialog } from "@/features/portfolio/contribution-plan/rules/use-rule-dialog";
import { instrumentsQuery } from "@/features/setup";
import { useT } from "@/i18n/i18n-provider";
import { ChoiceSelect } from "@/ui/form-fields/choice-select";
import { FormRow } from "@/ui/form-layout/form-row";
import { FormSection } from "@/ui/form-layout/form-section";

type InstrumentType = components["schemas"]["InstrumentType"];

interface RuleDialogFieldsProps {
  dialog: ReturnType<typeof useRuleDialog>;
  guaranteeName: string | undefined;
  // The sentence that follows from the answers: the securities that join the group today.
  line: string | undefined;
}

// The questions of a rule in the order of the conditions, each shown while it applies.
export function RuleDialogFields({
  dialog,
  guaranteeName,
  line,
}: RuleDialogFieldsProps) {
  const t = useT();
  const api = useApi();
  const { form, change, problem } = dialog;

  const instruments = useQuery(instrumentsQuery(api));
  const subtypes = useQuery({
    ...subtypesQuery(api, form.type as InstrumentType),
    enabled: form.type !== "",
  });

  const any = t("contributionPlan.rule.dialog.any");
  const types = [
    { value: "", label: any },
    ...instrumentTypes
      .filter((type) => type !== "currency")
      .map((type) => ({ value: type, label: typeLabel(t, type) })),
  ];
  const currencies = [
    { value: "", label: any },
    ...(instruments.data?.items ?? [])
      .filter((i) => i.type === "currency")
      .map((i) => ({ value: i.code, label: i.code })),
  ];
  const kindChoices = [
    { value: "", label: any },
    ...kinds.map((kind) => ({
      value: kind,
      label: kindLabel(t, kind),
    })),
  ];
  const liquidity = [
    { value: "any", label: any },
    { value: "yes", label: t("contributionPlan.rule.dialog.yes") },
    { value: "no", label: t("contributionPlan.rule.dialog.no") },
  ];
  const guarantees = [
    { value: "", label: any },
    {
      value: "covered",
      label: t("contributionPlan.rule.dialog.covered", {
        name: guaranteeName ?? "",
      }),
    },
    { value: "sovereign", label: t("contributionPlan.rule.dialog.sovereign") },
    { value: "uncovered", label: t("contributionPlan.rule.dialog.uncovered") },
  ];
  const subtypeItems = form.type === "" ? [] : (subtypes.data ?? []);

  return (
    <>
      <Field>
        <FieldLabel>{t("contributionPlan.rule.dialog.type")}</FieldLabel>
        <ChoiceSelect
          label={t("contributionPlan.rule.dialog.type")}
          choices={types}
          value={form.type}
          multiple={false}
          onChange={(value) => {
            dialog.changeType(typeof value === "string" ? value : "");
          }}
        />
      </Field>

      {subtypeItems.length > 0 && (
        <Field>
          <FieldLabel>{t("contributionPlan.rule.dialog.subtypes")}</FieldLabel>
          <CheckboxGroup
            aria-label={t("contributionPlan.rule.dialog.subtypes")}
            value={form.subtypes}
            onValueChange={(value) => {
              change({ subtypes: [...value] });
            }}
          >
            {subtypeItems.map((subtype) => (
              <Checkbox key={subtype} value={subtype}>
                {subtypeLabel(t, subtype)}
              </Checkbox>
            ))}
          </CheckboxGroup>
        </Field>
      )}

      {takesKind(form.type) && (
        <RuleChoice
          legend={t("contributionPlan.rule.dialog.returnKind")}
          choices={kindChoices}
          value={form.kind}
          onChange={(kind) => {
            change({ kind });
          }}
        />
      )}

      <FormSection legend={t("contributionPlan.rule.dialog.maturity")}>
        <FormRow>
          <Field invalid={problem !== undefined}>
            <FieldLabel>{t("contributionPlan.rule.dialog.from")}</FieldLabel>
            <NumberField
              value={form.from}
              format={{ useGrouping: false }}
              onValueChange={(from) => {
                change({ from });
              }}
            />
          </Field>

          <Field invalid={problem !== undefined}>
            <FieldLabel>{t("contributionPlan.rule.dialog.to")}</FieldLabel>
            <NumberField
              value={form.to}
              format={{ useGrouping: false }}
              onValueChange={(to) => {
                change({ to });
              }}
            />
            {problem !== undefined && (
              <FieldError>
                {t(`contributionPlan.rule.dialog.${problem}`)}
              </FieldError>
            )}
          </Field>
        </FormRow>
      </FormSection>

      <RuleChoice
        legend={t("contributionPlan.rule.dialog.liquidity")}
        choices={liquidity}
        value={form.liquidity}
        onChange={(value) => {
          change({
            liquidity: value === "yes" || value === "no" ? value : "any",
          });
        }}
      />

      {guaranteeName !== undefined && (
        <RuleChoice
          legend={t("contributionPlan.rule.dialog.guarantee")}
          choices={guarantees}
          value={form.guarantee}
          onChange={(guarantee) => {
            change({ guarantee });
          }}
        />
      )}

      <Field>
        <FieldLabel>{t("contributionPlan.rule.dialog.currency")}</FieldLabel>
        <ChoiceSelect
          label={t("contributionPlan.rule.dialog.currency")}
          choices={currencies}
          value={form.currency}
          multiple={false}
          onChange={(value) => {
            change({ currency: typeof value === "string" ? value : "" });
          }}
        />
        {line !== undefined && (
          <FieldDescription live="polite">{line}</FieldDescription>
        )}
      </Field>
    </>
  );
}
