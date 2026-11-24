import { PriceLayer } from "@/features/instruments/price-table/price-layer";
import { useT } from "@/i18n/i18n-provider";
import { DetailDialog } from "@/ui/dialogs/detail-dialog";

interface PriceDetailsProps {
  code: string;
  quote: string;
  // The dates of the first and the last quote of the series.
  first: string;
  last: string;
}

// L1, IM11: the button of the layer that lists the price of each date of one year.
export function PriceDetails({ code, quote, first, last }: PriceDetailsProps) {
  const t = useT();

  return (
    <DetailDialog
      title={t("instrument.prices.caption")}
      description={t("instrument.prices.layer.description")}
      summary={null}
      triggerLabel={t("instrument.prices.open")}
    >
      <PriceLayer code={code} quote={quote} first={first} last={last} />
    </DetailDialog>
  );
}
