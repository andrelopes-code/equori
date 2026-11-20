import { Field, FieldDescription, FieldLabel } from "@slotted/react/field";
import { useQuery } from "@tanstack/react-query";

import { useApi } from "@/api/api-context";
import type { components } from "@/api/schema.gen";
import { subtypeLabel, subtypesQuery } from "@/features/instruments";
import { RuleChoice } from "@/features/portfolio/contribution-plan/rules/rule-choice";
import {
  currencyChoices,
  guaranteeChoices,
  kindChoices,
  liquidityChoices,
  typeChoices,
} from "@/features/portfolio/contribution-plan/rules/rule-choices";
import { takesKind } from "@/features/portfolio/contribution-plan/rules/rule-form";
import { RuleMaturityFields } from "@/features/portfolio/contribution-plan/rules/rule-maturity-fields";
import type { useRuleDialog } from "@/features/portfolio/contribution-plan/rules/use-rule-dialog";
import { instrumentsQuery } from "@/features/setup";
import { useT } from "@/i18n/i18n-provider";
import { ChoiceSelect } from "@/ui/form-fields/choice-select";

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

  const subtypeItems = form.type === "" ? [] : (subtypes.data ?? []);

  return (
    <>
      <Field>
        <FieldLabel>{t("contributionPlan.rule.dialog.type")}</FieldLabel>
        <ChoiceSelect
          label={t("contributionPlan.rule.dialog.type")}
          choices={typeChoices(t)}
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
          <ChoiceSelect
            label={t("contributionPlan.rule.dialog.subtypes")}
            choices={subtypeItems.map((subtype) => ({
              value: subtype,
              label: subtypeLabel(t, subtype),
            }))}
            value={form.subtypes}
            multiple
            onChange={(value) => {
              change({ subtypes: Array.isArray(value) ? value : [] });
            }}
          />
        </Field>
      )}

      {takesKind(form.type) && (
        <RuleChoice
          legend={t("contributionPlan.rule.dialog.returnKind")}
          choices={kindChoices(t)}
          value={form.kind}
          onChange={(kind) => {
            change({ kind });
          }}
        />
      )}

      <RuleMaturityFields
        from={form.from}
        to={form.to}
        problem={problem}
        onFrom={(from) => {
          change({ from });
        }}
        onTo={(to) => {
          change({ to });
        }}
      />

      <RuleChoice
        legend={t("contributionPlan.rule.dialog.liquidity")}
        choices={liquidityChoices(t)}
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
          choices={guaranteeChoices(t, guaranteeName)}
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
          choices={currencyChoices(t, instruments.data?.items ?? [])}
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
