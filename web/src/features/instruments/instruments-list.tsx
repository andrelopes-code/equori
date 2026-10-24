import { Stack } from "@slotted/react/stack";

import type { InstrumentGroup } from "@/features/instruments/instrument-groups";
import {
  subtypeLabel,
  typeLabel,
} from "@/features/instruments/instrument-labels";
import { PriceCell } from "@/features/instruments/price-cell";
import type { LatestPrice } from "@/features/instruments/use-latest-prices";
import { formatDate } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { PhoneGroup } from "@/ui/phone-group";
import { PhoneList } from "@/ui/phone-list";
import { useAppLink } from "@/ui/use-app-link";

// Below 600 px the instruments are rows grouped by type (mobile.md M1): code and name, the
// subtype and exchange under them, the latest price at the end.
export function InstrumentsList({
  groups,
  latest,
  loading,
}: {
  groups: readonly InstrumentGroup[];
  latest: ReadonlyMap<string, LatestPrice>;
  loading: boolean;
}) {
  const t = useT();
  const [locale] = useAppLocale();
  const follow = useAppLink();
  if (loading)
    return (
      <PhoneList
        label={t("instruments.caption")}
        loading
        rows={[]}
        empty={t("instruments.empty")}
      />
    );
  return (
    <Stack gap={5}>
      {groups.map((group) => {
        const label = typeLabel(t, group.type);
        return (
          <PhoneGroup key={group.type} label={label}>
            <PhoneList
              label={label}
              loading={false}
              empty={t("instruments.empty")}
              rows={group.items.map((i) => {
                const price = latest.get(i.code)?.price;
                return {
                  key: i.code,
                  href: `/instruments/${i.code}`,
                  onOpen: follow({
                    to: "/instruments/$code",
                    params: { code: i.code },
                  }),
                  title: `${i.code} · ${i.name}`,
                  lines: [
                    [
                      i.subtype === undefined ? "" : subtypeLabel(t, i.subtype),
                      i.exchange ?? "",
                      i.quote_currency ?? "",
                    ]
                      .filter((part) => part !== "")
                      .join(" · "),
                    price === null || price === undefined
                      ? ""
                      : formatDate(price.date, locale),
                  ].filter((line) => line !== ""),
                  end: <PriceCell latest={latest.get(i.code)} />,
                };
              })}
            />
          </PhoneGroup>
        );
      })}
    </Stack>
  );
}
