import { Field, FieldError, FieldLabel } from "@slotted/react/field";
import { TextField } from "@slotted/react/text-field";

import { BrokerageFields } from "@/features/transactions/brokerage-account/brokerage-fields";
import { ExchangeRateField } from "@/features/transactions/brokerage-account/exchange-rate-field";
import { MissingCashNotice } from "@/features/transactions/brokerage-account/missing-cash-notice";
import type { EntryKind } from "@/features/transactions/entry-model/entry-kind";
import { EntryKindPicker } from "@/features/transactions/entry-kind-picker/entry-kind-picker";
import { NoteCostFields } from "@/features/transactions/note-entry/note-cost-fields";
import type { NoteDraft } from "@/features/transactions/note-entry/note-draft";
import { NoteOrders } from "@/features/transactions/note-entry/note-orders";
import type { NoteView } from "@/features/transactions/note-entry/use-note-entry";
import { TradeDatesFields } from "@/features/transactions/trade-entry/trade-dates-fields";
import { useT } from "@/i18n/i18n-provider";
import { FormLayout } from "@/ui/form-layout/form-layout";

interface NoteFormProps {
  draft: NoteDraft;
  onChange: (draft: NoteDraft) => void;
  view: NoteView;
  errors: Record<string, string>;
  scale: (code: string) => number;
  onKind: (kind: EntryKind) => void;
}

// The orders of one brokerage note, recorded together with their costs split by value (A228
// IO17). The brokerage and the cash account are the trade form's own fields.
export function NoteForm({
  draft,
  onChange,
  view,
  errors,
  scale,
  onKind,
}: NoteFormProps) {
  const t = useT();
  const { base, currency } = view;
  const currencyScale = currency === undefined ? 0 : scale(currency);
  const sale = draft.orders.some((order) => order.side === "sell");
  const allSales =
    draft.orders.length > 0 && draft.orders.every((o) => o.side === "sell");

  function handleChange(patch: Partial<NoteDraft>) {
    onChange({ ...draft, ...patch });
  }

  return (
    <FormLayout>
      <EntryKindPicker value="brokerage_note" onChange={onKind} investments />

      <BrokerageFields
        brokerages={view.brokerages}
        brokerage={view.brokerage}
        payers={view.payers}
        payer={view.payer}
        balance={view.balance}
        base={currency}
        date={draft.date}
        money={allSales ? "in" : "out"}
        errors={errors}
        scale={scale}
        onBrokerage={(id) => {
          handleChange({ brokerageId: id, cashAccountId: null });
        }}
        onCash={(id) => {
          handleChange({ cashAccountId: id });
        }}
      />

      {view.brokerage !== undefined && !view.baseCash && base !== undefined && (
        <MissingCashNotice brokerage={view.brokerage} base={base} />
      )}

      <TradeDatesFields draft={draft} errors={errors} onChange={handleChange} />

      <NoteOrders
        orders={draft.orders}
        grosses={view.grosses}
        shares={view.shares}
        base={currency}
        scale={scale}
        errors={errors}
        onChange={(orders) => {
          handleChange({ orders });
        }}
      />

      <ExchangeRateField
        base={base}
        currency={currency}
        value={draft.exchangeRate}
        error={errors.exchange_rate}
        onChange={(exchangeRate) => {
          handleChange({ exchangeRate });
        }}
      />

      <NoteCostFields
        draft={draft}
        currency={currency}
        currencyScale={currencyScale}
        sale={sale}
        errors={errors}
        onChange={handleChange}
      />

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
