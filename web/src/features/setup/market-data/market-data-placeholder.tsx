import { Inline } from "@slotted/react/inline";
import { Skeleton, SkeletonRegion } from "@slotted/react/skeleton";
import { Stack } from "@slotted/react/stack";

import { SettingsGroup } from "@/features/setup/settings-layout/settings-group";
import { useT } from "@/i18n/i18n-provider";

const priceRows = 4;
const indexRows = 6;

// A223: the two cards of the market data section while the feeds load. The titles are chrome and
// stay real; each row reserves a name, a description and a switch.
export function MarketDataPlaceholder() {
  const t = useT();

  return (
    <SkeletonRegion>
      <SettingsGroup title={t("marketData.prices")}>
        {rows(priceRows)}
      </SettingsGroup>

      <SettingsGroup title={t("marketData.indexes")}>
        {rows(indexRows)}
      </SettingsGroup>
    </SkeletonRegion>
  );
}

function rows(count: number) {
  return Array.from({ length: count }, (_, i) => (
    <Inline key={i} gap={4} align="center" justify="between" wrap="nowrap">
      <Stack gap={1}>
        <Skeleton shape="text" inlineSize="12rem" />
        <Skeleton shape="text" inlineSize="20rem" />
      </Stack>
      <Skeleton shape="block" inlineSize="2.5rem" blockSize="1.5rem" />
    </Inline>
  ));
}
