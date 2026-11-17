import { Field, FieldError, FieldLabel } from "@slotted/react/field";
import { Inline } from "@slotted/react/inline";
import { NumberField } from "@slotted/react/number-field";
import { Segment, SegmentedControl } from "@slotted/react/segmented-control";
import { TextField } from "@slotted/react/text-field";

import {
  actionKindKeys,
  offeredKinds,
} from "@/features/transactions/action-entry/action-kind";
import { ActionBonusFields } from "@/features/transactions/action-entry/action-bonus-fields";
import { ActionUnitTaxFields } from "@/features/transactions/action-entry/action-unit-tax-fields";
import type { ActionDraft } from "@/features/transactions/action-entry/action-draft";
import { ActionPreviewText } from "@/features/transactions/action-entry/action-preview-text";
import type { useActionEntry } from "@/features/transactions/action-entry/use-action-entry";
import { BrokerageFields } from "@/features/transactions/brokerage-account/brokerage-fields";
import type { EntryKind } from "@/features/transactions/entry-model/entry-kind";
import { EntryKindPicker } from "@/features/transactions/entry-kind-picker/entry-kind-picker";
import { useT } from "@/i18n/i18n-provider";
import { DateInput } from "@/ui/form-fields/date-input";
import { FormLayout } from "@/ui/form-layout/form-layout";
import { FormRow } from "@/ui/form-layout/form-row";

interface ActionFormProps {
  draft: ActionDraft;
  onChange: (draft: ActionDraft) => void;
  view: ReturnType<typeof useActionEntry>["view"];
  errors: Record<string, string>;
  scale: (code: string) => number;
  onKind: (kind: EntryKind) => void;
}

const wholeNumber = { maximumFractionDigits: 0, useGrouping: false };

// A split, a reverse split or a bonus of one holding, recorded on the first day without the right
// (A228 IO22). Families read: segmented-control, number-field, field, text-field.
export function ActionForm({
  draft,
  onChange,
  view,
  errors,
  scale,
  onKind,
}: ActionFormProps) {
  const t = useT();
  const kinds = offeredKinds(view.fund);
  const unitTax = draft.kind === "unit_tax";

  function handleChange(patch: Partial<ActionDraft>) {
    onChange({ ...draft, ...patch });
  }

  return (
    <FormLayout>
      <EntryKindPicker value="corporate_action" onChange={onKind} investments />

      <BrokerageFields
        brokerages={view.brokerages}
        brokerage={view.brokerage}
        instrument={view.instrument}
        heldCodes={view.heldCodes}
        payers={[]}
        payer={undefined}
        balance={undefined}
        base={view.base}
        date={draft.date}
        money="in"
        errors={errors}
        scale={scale}
        onBrokerage={(id) => {
          handleChange({ brokerageId: id, instrument: null });
        }}
        onInstrument={(code) => {
          handleChange({ instrument: code });
        }}
        onCash={() => undefined}
      />

      <Field required>
        <FieldLabel>{t("action.kind")}</FieldLabel>
        <Inline>
          <SegmentedControl
            aria-label={t("action.kind")}
            value={draft.kind}
            onValueChange={(kind) => {
              const next = kinds.find((k) => k === kind);
              if (next !== undefined) handleChange({ kind: next });
            }}
          >
            {kinds.map((kind) => (
              <Segment key={kind} value={kind}>
                {t(actionKindKeys[kind])}
              </Segment>
            ))}
          </SegmentedControl>
        </Inline>
      </Field>

      <Field required invalid={errors.date !== undefined}>
        <FieldLabel>{t(unitTax ? "entry.date" : "action.date")}</FieldLabel>
        <DateInput
          name="date"
          value={draft.date}
          onChange={(date) => {
            handleChange({ date });
          }}
        />
        {errors.date !== undefined && <FieldError>{errors.date}</FieldError>}
      </Field>

      {unitTax && (
        <ActionUnitTaxFields
          draft={draft}
          instrument={view.instrument}
          base={view.base}
          scale={scale}
          errors={errors}
          onChange={handleChange}
        />
      )}

      {!unitTax && (
        <FormRow>
          <Field
            required
            width="medium"
            invalid={errors.ratio_from !== undefined}
          >
            <FieldLabel>{t("action.ratioFrom")}</FieldLabel>
            <NumberField
              name="ratio_from"
              value={draft.ratioFrom}
              min={1}
              max={1000000}
              format={wholeNumber}
              onValueChange={(ratioFrom) => {
                handleChange({ ratioFrom });
              }}
            />
            {errors.ratio_from !== undefined && (
              <FieldError>{errors.ratio_from}</FieldError>
            )}
          </Field>

          <Field
            required
            width="medium"
            invalid={errors.ratio_to !== undefined}
          >
            <FieldLabel>{t("action.ratioTo")}</FieldLabel>
            <NumberField
              name="ratio_to"
              value={draft.ratioTo}
              min={1}
              max={1000000}
              format={wholeNumber}
              onValueChange={(ratioTo) => {
                handleChange({ ratioTo });
              }}
            />
            {errors.ratio_to !== undefined && (
              <FieldError>{errors.ratio_to}</FieldError>
            )}
          </Field>
        </FormRow>
      )}

      {!unitTax && <ActionPreviewText view={view} />}

      {draft.kind === "bonus" && (
        <ActionBonusFields
          draft={draft}
          base={view.base}
          errors={errors}
          onChange={handleChange}
        />
      )}

      <Field invalid={errors.description !== undefined}>
        <FieldLabel>{t("facts.description")}</FieldLabel>
        <TextField
          name="description"
          value={draft.description}
          maxLength={500}
          onChange={(event) => {
            handleChange({ description: event.target.value });
          }}
        />
        {errors.description !== undefined && (
          <FieldError>{errors.description}</FieldError>
        )}
      </Field>
    </FormLayout>
  );
}
