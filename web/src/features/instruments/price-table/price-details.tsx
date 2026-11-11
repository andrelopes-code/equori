import {
  Collapsible,
  CollapsibleHeader,
  CollapsiblePanel,
  CollapsibleTrigger,
} from "@slotted/react/collapsible";

import type { components } from "@/api/schema.gen";
import { PriceTable } from "@/features/instruments/price-table/price-table";
import { useT } from "@/i18n/i18n-provider";

type Price = components["schemas"]["Price"];

// The audit detail of the chart: the price of each date with its source, behind one trigger.
export function PriceDetails({ prices }: { prices: readonly Price[] }) {
  const t = useT();

  return (
    <Collapsible mount="lazy">
      <CollapsibleHeader>
        <CollapsibleTrigger>
          {t("instrument.prices.caption")}
        </CollapsibleTrigger>
      </CollapsibleHeader>
      <CollapsiblePanel>
        <PriceTable prices={prices} loading={false} />
      </CollapsiblePanel>
    </Collapsible>
  );
}
