import { useMemo } from "react";

import type { ValueFormat } from "@/features/assistant/view/value-text";
import { catalogKey } from "@/features/assistant/model/catalog-key";
import { useScale } from "@/features/setup";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";

// The format of the figures of a view: amounts through useMoneyFormat, so privacy masks them (C4).
export function useValueFormat(): ValueFormat {
  const t = useT();
  const [locale] = useAppLocale();
  const fmt = useMoneyFormat();
  const scaleOf = useScale();

  return useMemo(
    () => ({
      locale,
      money: (m) => fmt.money(m, scaleOf?.(m.currency) ?? 2),
      label: (key, count) => {
        const k = catalogKey(key);
        return k === undefined ? key : t(k, { count: String(count ?? 0) });
      },
    }),
    [locale, fmt, scaleOf, t],
  );
}
