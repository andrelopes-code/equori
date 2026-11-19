import { CalcTable } from "@/features/calculators/calculator-frame/calc-table";
import type { ComparisonRow } from "@/features/calculators/indexer-comparison/compare";
import type { Security } from "@/features/calculators/indexer-comparison/security";
import { securityText } from "@/features/calculators/indexer-comparison/security-text";
import { formatRate } from "@/features/calculators/model/format-rate";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";

interface ComparisonTableProps {
  securities: readonly Security[];
  // One row per security, in order; null for a security whose rate is unknown.
  rows: readonly (ComparisonRow | null)[];
  currency: string;
  scale: number;
}

// IC3: the securities in the order they were typed, with their yields after tax; the tax
// column holds the redemption tax too (spec 2026-11-19 RT5). No row is marked, sorted or
// worded above another.
export function ComparisonTable({
  securities,
  rows,
  currency,
  scale,
}: ComparisonTableProps) {
  const t = useT();
  const [locale] = useAppLocale();
  const fmt = useMoneyFormat();
  const money = (amount: number) => fmt.money({ amount, currency }, scale);

  return (
    <CalcTable
      caption={t("calc.indexerComparison.col.security")}
      headers={[
        t("calc.indexerComparison.col.security"),
        t("calc.indexerComparison.col.gross"),
        t("calc.indexerComparison.col.tax"),
        t("calc.indexerComparison.col.net"),
        t("calc.indexerComparison.col.netRate"),
      ]}
      rows={securities.map((security, i) => {
        const row = rows[i];
        const text = securityText(security, t, locale);
        const unknown =
          security.rate === null ? "" : t("calc.indexerComparison.noRate");

        return {
          key: String(i),
          cells:
            row === null || row === undefined
              ? [text, unknown, "", "", ""]
              : [
                  text,
                  money(row.gross),
                  money(row.tax + row.redemption),
                  money(row.net),
                  formatRate(row.netAnnualRate, locale, { min: 2, max: 2 }),
                ],
        };
      })}
    />
  );
}
