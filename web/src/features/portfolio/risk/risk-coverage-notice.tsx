import { Inline } from "@slotted/react/inline";
import { Link } from "@slotted/react/link";
import { Text } from "@slotted/react/typography";

import type { components } from "@/api/schema.gen";
import { formatReferenceMonthCompact } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { routeTo } from "@/ui/navigation/route-to";

type RiskReport = components["schemas"]["RiskReport"];

interface RiskCoverageNoticeProps {
  report: RiskReport;
}

// RK3: the security left out the longest, its months and what it costs the figures, with the way
// to its prices, on one line under the verdict. It draws no surface: the section is the only
// frame (owner review of 2026-11-15, no card inside a card). A report without one draws nothing.
export function RiskCoverageNotice({ report }: RiskCoverageNoticeProps) {
  const t = useT();
  const [tag] = useAppLocale();

  const longest = report.left_out[0];
  if (longest === undefined) return null;

  const month = (iso: string) =>
    formatReferenceMonthCompact(iso.slice(0, 7), tag);
  const words = {
    code: longest.instrument,
    from: month(longest.from),
    to: month(longest.to),
    months: longest.months,
    others: report.left_out.length - 1,
  };

  return (
    <Inline gap={4} align="center">
      <Text size="sm" tone="warning">
        {report.left_out.length === 1
          ? t("portfolio.risk.coverage.one", words)
          : t("portfolio.risk.coverage.many", words)}
      </Text>
      <Text size="sm">
        <Link
          render={routeTo({
            to: "/instruments/$code",
            params: { code: longest.instrument },
          })}
        >
          {t("portfolio.risk.coverage.action", { code: longest.instrument })}
        </Link>
      </Text>
    </Inline>
  );
}
