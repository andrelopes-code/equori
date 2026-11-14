import { Text } from "@slotted/react/typography";

import type { useActionEntry } from "@/features/transactions/action-entry/use-action-entry";
import { formatRate } from "@/features/instruments";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";

type View = ReturnType<typeof useActionEntry>["view"];

interface ActionPreviewTextProps {
  view: Pick<View, "instrument" | "held" | "preview" | "quantityScale">;
}

// The units before and after the action and, when one is left over, the fraction that leaves the
// position (A228 IO26).
export function ActionPreviewText({ view }: ActionPreviewTextProps) {
  const t = useT();
  const [locale] = useAppLocale();
  const fmt = useMoneyFormat();
  const { instrument, held, preview, quantityScale } = view;
  if (
    instrument === null ||
    held === undefined ||
    preview === null ||
    quantityScale === null
  )
    return null;

  const units = (amount: number) =>
    fmt.number({ amount, currency: instrument }, quantityScale);

  return (
    <>
      <Text size="sm" tone="muted">
        {t("action.preview", {
          held: units(held),
          received: units(preview.received),
        })}
      </Text>

      {preview.fraction !== "0" && (
        <Text size="sm" tone="muted">
          {t("action.fraction", {
            fraction: formatRate(preview.fraction, locale),
          })}
        </Text>
      )}
    </>
  );
}
