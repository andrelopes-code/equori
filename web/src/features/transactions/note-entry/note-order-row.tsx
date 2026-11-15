import { IconButton } from "@slotted/react/button";
import { Field, FieldError, FieldLabel } from "@slotted/react/field";
import {
  FieldGroup,
  FieldGroupContent,
  FieldGroupLegend,
} from "@slotted/react/field-group";
import { Glyph, Icon } from "@slotted/react/icon";
import { Inline } from "@slotted/react/inline";
import { Segment, SegmentedControl } from "@slotted/react/segmented-control";
import { Text } from "@slotted/react/typography";
import { useId } from "react";

import { InstrumentField } from "@/features/transactions/brokerage-account/instrument-field";
import type { NoteOrder } from "@/features/transactions/note-entry/note-draft";
import styles from "@/features/transactions/note-entry/note-order-row.module.css";
import { useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";
import { FormRow } from "@/ui/form-layout/form-row";
import { MoneyInput } from "@/ui/money/money-input";
import { PriceInput } from "@/ui/money/price-input";

interface NoteOrderRowProps {
  order: NoteOrder;
  // The position of the order in the note, from 0.
  index: number;
  // Minor units of the base currency; null while the order is incomplete.
  gross: number | null;
  share: number;
  base: string | undefined;
  scale: (code: string) => number;
  errors: Record<string, string>;
  onChange: (patch: Partial<NoteOrder>) => void;
  onRemove: () => void;
}

// One order of the note: side, investment, quantity and unit price, then its gross and its share
// of the costs. Families read: field-group, segmented-control, field.
export function NoteOrderRow({
  order,
  index,
  gross,
  share,
  base,
  scale,
  errors,
  onChange,
  onRemove,
}: NoteOrderRowProps) {
  const t = useT();
  const titleId = useId();
  const fmt = useMoneyFormat();
  const n = index + 1;
  const prefix = `orders[${String(index)}]`;
  const instrumentError = errors[`${prefix}.instrument`];
  const quantityError = errors[`${prefix}.quantity`];
  const priceError = errors[`${prefix}.unit_price`];
  const amount = (value: number) =>
    base === undefined
      ? ""
      : fmt.money({ amount: value, currency: base }, scale(base));

  const figures =
    gross === null
      ? ""
      : t("note.orderFigures", {
          gross: `${t("trade.gross")} ${amount(gross)}`,
          share: t("note.feeShare", { amount: amount(share) }),
        });

  return (
    // The legend holds the removal button, so the group is named by the title alone.
    <FieldGroup necessity="none" aria-labelledby={titleId}>
      <FieldGroupLegend className={styles.title}>
        <Inline justify="between" align="center" wrap="nowrap">
          <span id={titleId}>{t("note.order", { n })}</span>

          <IconButton
            aria-label={t("note.removeOrder", { n })}
            variant="ghost"
            tone="secondary"
            onClick={onRemove}
          >
            <Icon>
              <Glyph name="x" />
            </Icon>
          </IconButton>
        </Inline>
      </FieldGroupLegend>
      <FieldGroupContent>
        <Field required>
          <FieldLabel>{t("trade.side")}</FieldLabel>
          <Inline>
            <SegmentedControl
              aria-label={t("trade.side")}
              value={order.side}
              onValueChange={(side) => {
                if (side === "buy" || side === "sell") onChange({ side });
              }}
            >
              <Segment value="buy">{t("trade.side.buy")}</Segment>
              <Segment value="sell">{t("trade.side.sell")}</Segment>
            </SegmentedControl>
          </Inline>
        </Field>

        <Field required invalid={instrumentError !== undefined}>
          <FieldLabel>{t("trade.investment")}</FieldLabel>
          <InstrumentField
            value={order.instrument}
            heldCodes={null}
            invalid={instrumentError !== undefined}
            onChange={(instrument) => {
              onChange({ instrument });
            }}
          />
          {instrumentError !== undefined && (
            <FieldError>{instrumentError}</FieldError>
          )}
        </Field>

        <FormRow>
          <Field required width="medium" invalid={quantityError !== undefined}>
            <FieldLabel>{t("trade.quantity")}</FieldLabel>
            <MoneyInput
              size="field"
              value={order.quantity}
              currency={order.instrument ?? ""}
              scale={order.instrument === null ? 0 : scale(order.instrument)}
              sign="neutral"
              onChange={(quantity) => {
                onChange({ quantity });
              }}
            />
            {quantityError !== undefined && (
              <FieldError>{quantityError}</FieldError>
            )}
          </Field>

          <Field required width="medium" invalid={priceError !== undefined}>
            <FieldLabel>{t("trade.unitPrice")}</FieldLabel>
            <PriceInput
              name={`${prefix}.unit_price`}
              value={order.unitPrice}
              currency={base ?? ""}
              invalid={priceError !== undefined}
              onChange={(unitPrice) => {
                onChange({ unitPrice });
              }}
            />
            {priceError !== undefined && <FieldError>{priceError}</FieldError>}
          </Field>
        </FormRow>

        {gross !== null && <Text size="sm">{figures}</Text>}
      </FieldGroupContent>
    </FieldGroup>
  );
}
