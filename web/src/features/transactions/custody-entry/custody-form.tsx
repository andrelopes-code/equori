import { Field, FieldError, FieldLabel } from "@slotted/react/field";
import { TextField } from "@slotted/react/text-field";

import { AccountField } from "@/features/transactions/account-field/account-field";
import { BrokerageFields } from "@/features/transactions/brokerage-account/brokerage-fields";
import type { CustodyDraft } from "@/features/transactions/custody-entry/custody-draft";
import type { useCustodyEntry } from "@/features/transactions/custody-entry/use-custody-entry";
import type { EntryKind } from "@/features/transactions/entry-model/entry-kind";
import { EntryKindPicker } from "@/features/transactions/entry-kind-picker/entry-kind-picker";
import { useT } from "@/i18n/i18n-provider";
import { DateInput } from "@/ui/form-fields/date-input";
import { FormLayout } from "@/ui/form-layout/form-layout";
import { MoneyInput } from "@/ui/money/money-input";

interface CustodyFormProps {
  draft: CustodyDraft;
  onChange: (draft: CustodyDraft) => void;
  view: ReturnType<typeof useCustodyEntry>["view"];
  errors: Record<string, string>;
  scale: (code: string) => number;
  onKind: (kind: EntryKind) => void;
}

// Units of one holding moved to another brokerage with their cost (A228 IO29). Families read:
// field, text-field. The accounts and the quantity are the application's own controls.
export function CustodyForm({
  draft,
  onChange,
  view,
  errors,
  scale,
  onKind,
}: CustodyFormProps) {
  const t = useT();
  const { instrument } = view;

  function handleChange(patch: Partial<CustodyDraft>) {
    onChange({ ...draft, ...patch });
  }

  return (
    <FormLayout>
      <EntryKindPicker value="custody_transfer" onChange={onKind} investments />

      <BrokerageFields
        brokerages={view.brokerages}
        brokerage={view.brokerage}
        instrument={instrument}
        held={view.held}
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
          handleChange({ brokerageId: id, instrument: null, toId: null });
        }}
        onInstrument={(code) => {
          handleChange({
            instrument: code,
            brokerageId: view.brokerage?.id ?? null,
          });
        }}
        onCash={() => undefined}
      />

      <Field required invalid={errors.to !== undefined}>
        <FieldLabel>{t("custody.to")}</FieldLabel>
        <AccountField
          compact
          name="to"
          title={t("custody.to")}
          context={t("custody.to")}
          accounts={view.receivers}
          value={draft.toId}
          exclude={null}
          amount={0}
          direction="in"
          date={draft.date}
          categoryId={null}
          payeeId={null}
          kind="transfer"
          currency={view.base ?? ""}
          scale={scale}
          onChange={(toId) => {
            handleChange({ toId });
          }}
        />
        {errors.to !== undefined && <FieldError>{errors.to}</FieldError>}
      </Field>

      <Field required invalid={errors.date !== undefined}>
        <FieldLabel>{t("entry.date")}</FieldLabel>
        <DateInput
          name="date"
          value={draft.date}
          onChange={(date) => {
            handleChange({ date });
          }}
        />
        {errors.date !== undefined && <FieldError>{errors.date}</FieldError>}
      </Field>

      <Field required width="medium" invalid={errors.quantity !== undefined}>
        <FieldLabel>{t("custody.quantity")}</FieldLabel>
        <MoneyInput
          size="field"
          value={draft.quantity}
          currency={instrument ?? ""}
          scale={instrument === null ? 0 : scale(instrument)}
          sign="neutral"
          onChange={(quantity) => {
            handleChange({ quantity });
          }}
        />
        {errors.quantity !== undefined && (
          <FieldError>{errors.quantity}</FieldError>
        )}
      </Field>

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
