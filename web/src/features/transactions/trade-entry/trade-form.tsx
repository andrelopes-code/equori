import { Field, FieldError, FieldLabel } from "@slotted/react/field";
import { Inline } from "@slotted/react/inline";
import { Segment, SegmentedControl } from "@slotted/react/segmented-control";
import { TextField } from "@slotted/react/text-field";
import type { ReactNode } from "react";

import { BrokerageFields } from "@/features/transactions/brokerage-account/brokerage-fields";
import { MissingCashNotice } from "@/features/transactions/brokerage-account/missing-cash-notice";
import { ShortfallNotice } from "@/features/transactions/brokerage-account/shortfall-notice";
import type { EntryKind } from "@/features/transactions/entry-model/entry-kind";
import { EntryKindPicker } from "@/features/transactions/entry-kind-picker/entry-kind-picker";
import type { TradeDraft } from "@/features/transactions/trade-entry/trade-draft";
import { TradeAside } from "@/features/transactions/trade-entry/trade-aside";
import { TradeCostFields } from "@/features/transactions/trade-entry/trade-cost-fields";
import { TradePriceField } from "@/features/transactions/trade-entry/trade-price-field";
import type { TradeView } from "@/features/transactions/trade-entry/use-trade-entry";
import { useT } from "@/i18n/i18n-provider";
import { DateInput } from "@/ui/form-fields/date-input";
import { FormLayout } from "@/ui/form-layout/form-layout";
import { MoneyInput } from "@/ui/money/money-input";

interface TradeFormProps {
  draft: TradeDraft;
  onChange: (draft: TradeDraft) => void;
  view: TradeView;
  errors: Record<string, string>;
  scale: (code: string) => number;
  // Absent on a correction: a transaction keeps its kind (A227 IC2).
  onKind?: (kind: EntryKind) => void;
  // Fields after the description, such as the reason of a correction.
  children?: ReactNode;
}

// Families read: segmented-control, field, text-field, stat-card. The side is two exclusive words
// (a segmented control); the money fields are the application's own MoneyInput (a till-style
// entry, O7); the accounts are AccountField, offered only the accounts the contract accepts.
export function TradeForm({
  draft,
  onChange,
  view,
  errors,
  scale,
  onKind,
  children,
}: TradeFormProps) {
  const t = useT();
  const set = (patch: Partial<TradeDraft>) => {
    onChange({ ...draft, ...patch });
  };
  const { base, instrument } = view;
  const sell = draft.side === "sell";
  const baseScale = base === undefined ? 0 : scale(base);

  return (
    <FormLayout aside={<TradeAside view={view} sell={sell} scale={scale} />}>
      {onKind !== undefined && (
        <EntryKindPicker value="trade" onChange={onKind} investments />
      )}

      <Field required>
        <FieldLabel>{t("trade.side")}</FieldLabel>
        {/* The segments take their labels' width, as the entry kind's do (F3). */}
        <Inline>
          <SegmentedControl
            aria-label={t("trade.side")}
            value={draft.side}
            onValueChange={(side) => {
              if (side === "buy" || side === "sell") set({ side });
            }}
          >
            <Segment value="buy">{t("trade.side.buy")}</Segment>
            <Segment value="sell">{t("trade.side.sell")}</Segment>
          </SegmentedControl>
        </Inline>
      </Field>

      <BrokerageFields
        brokerages={view.brokerages}
        brokerage={view.brokerage}
        instrument={view.instrument}
        held={sell ? undefined : view.held}
        heldCodes={view.heldCodes}
        payers={view.payers}
        payer={view.payer}
        balance={view.balance}
        base={base}
        date={draft.date}
        money={sell ? "in" : "out"}
        errors={errors}
        scale={scale}
        onBrokerage={(id) => {
          set({ brokerageId: id, instrument: null, cashAccountId: null });
        }}
        onInstrument={(code) => {
          set({ instrument: code });
        }}
        onCash={(id) => {
          set({ cashAccountId: id });
        }}
      />

      {view.brokerage !== undefined && !view.baseCash && base !== undefined && (
        <MissingCashNotice brokerage={view.brokerage} base={base} />
      )}

      <Field required invalid={errors.date !== undefined}>
        <FieldLabel>{t("entry.date")}</FieldLabel>
        <DateInput
          name="date"
          value={draft.date}
          onChange={(date) => {
            set({ date });
          }}
        />
        {errors.date !== undefined && <FieldError>{errors.date}</FieldError>}
      </Field>

      <Field required width="medium" invalid={errors.quantity !== undefined}>
        <FieldLabel>{t("trade.quantity")}</FieldLabel>
        <MoneyInput
          size="field"
          value={draft.quantity}
          currency={instrument ?? ""}
          scale={instrument === null ? 0 : scale(instrument)}
          sign="neutral"
          onChange={(quantity) => {
            set({ quantity });
          }}
        />
        {errors.quantity !== undefined && (
          <FieldError>{errors.quantity}</FieldError>
        )}
      </Field>

      <TradePriceField
        draft={draft}
        view={view}
        errors={errors}
        scale={scale}
        onChange={set}
      />

      <TradeCostFields
        draft={draft}
        base={base}
        baseScale={baseScale}
        errors={errors}
        onChange={set}
      />

      {view.shortfall !== null && view.payer !== undefined && (
        <ShortfallNotice
          payer={view.payer}
          amount={view.shortfall}
          scale={baseScale}
        />
      )}

      <Field invalid={errors.description !== undefined}>
        <FieldLabel>{t("facts.description")}</FieldLabel>
        <TextField
          name="description"
          value={draft.description}
          maxLength={500}
          onChange={(event) => {
            set({ description: event.target.value });
          }}
        />
        {errors.description !== undefined && (
          <FieldError>{errors.description}</FieldError>
        )}
      </Field>

      {children}
    </FormLayout>
  );
}
