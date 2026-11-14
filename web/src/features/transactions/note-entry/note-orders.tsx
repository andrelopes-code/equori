import { Button } from "@slotted/react/button";
import { Inline } from "@slotted/react/inline";
import { Text } from "@slotted/react/typography";

import { emptyOrder } from "@/features/transactions/note-entry/note-draft";
import type { NoteOrder } from "@/features/transactions/note-entry/note-draft";
import { NoteOrderRow } from "@/features/transactions/note-entry/note-order-row";
import { useT } from "@/i18n/i18n-provider";
import { FormSection } from "@/ui/form-layout/form-section";

// The API accepts at most 50 orders in a note.
const maxOrders = 50;

interface NoteOrdersProps {
  orders: readonly NoteOrder[];
  grosses: readonly (number | null)[];
  shares: readonly number[];
  base: string | undefined;
  scale: (code: string) => number;
  errors: Record<string, string>;
  onChange: (orders: NoteOrder[]) => void;
}

// The orders of the note, one block each, and the button that adds one after the last.
export function NoteOrders({
  orders,
  grosses,
  shares,
  base,
  scale,
  errors,
  onChange,
}: NoteOrdersProps) {
  const t = useT();

  function handleOrder(index: number, patch: Partial<NoteOrder>) {
    onChange(orders.map((o, i) => (i === index ? { ...o, ...patch } : o)));
  }

  function handleRemove(index: number) {
    onChange(orders.filter((_, i) => i !== index));
  }

  function handleAdd() {
    onChange([...orders, emptyOrder()]);
  }

  return (
    <FormSection legend={t("note.orders")}>
      {orders.map((order, index) => (
        <NoteOrderRow
          // An order has no identity beyond its position in the note.
          key={index}
          order={order}
          index={index}
          gross={grosses[index] ?? null}
          share={shares[index] ?? 0}
          base={base}
          scale={scale}
          errors={errors}
          onChange={(patch) => {
            handleOrder(index, patch);
          }}
          onRemove={() => {
            handleRemove(index);
          }}
        />
      ))}

      {errors.orders !== undefined && (
        <Text size="sm" tone="danger">
          {errors.orders}
        </Text>
      )}

      <Inline>
        <Button
          size="sm"
          variant="ghost"
          tone="secondary"
          disabled={orders.length >= maxOrders}
          onClick={handleAdd}
        >
          {t("note.addOrder")}
        </Button>
      </Inline>
    </FormSection>
  );
}
