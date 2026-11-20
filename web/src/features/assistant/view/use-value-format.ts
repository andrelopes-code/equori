import { useMemo } from "react";

import type { ValueFormat } from "@/features/assistant/view/value-text";
import { wholeUnits } from "@/features/assistant/view/whole-units";
import { catalogKey } from "@/features/assistant/model/catalog-key";
import { useScale } from "@/features/setup";
import { numberFormatter } from "@/i18n/format";
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
      whole: (m, signed) => {
        const unit =
          m.amount === 0
            ? m
            : {
                ...m,
                amount: wholeUnits(m.amount, scaleOf?.(m.currency) ?? 2),
              };
        return signed
          ? fmt.signed(unit, 0, { symbol: false })
          : fmt.money(unit, 0);
      },
      delta: (m) =>
        fmt.signed(m, scaleOf?.(m.currency) ?? 2, { symbol: false }),
      label: (key, count) => {
        const k = catalogKey(key);
        if (k === "assistantView.unit.points") {
          const n = numberFormatter(locale, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          });
          return t(k, { n: n.format((count ?? 0) / 100) });
        }

        return k === undefined ? key : t(k, { count: String(count ?? 0) });
      },
    }),
    [locale, fmt, scaleOf, t],
  );
}
