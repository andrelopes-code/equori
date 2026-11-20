import { Button } from "@slotted/react/button";
import { Inline } from "@slotted/react/inline";
import { Text } from "@slotted/react/typography";
import { useQuery } from "@tanstack/react-query";

import { useApi } from "@/api/api-context";
import type { components } from "@/api/schema.gen";
import { useRequestHistory } from "@/features/instruments";
import { meQuery } from "@/features/session";
import { formatReferenceMonth } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";

type RiskReport = components["schemas"]["RiskReport"];

interface RiskCoverageNoticeProps {
  report: RiskReport;
  // Called once the history of every security left out is requested; the section then reads
  // the report again until the prices arrive.
  onRequested: () => void;
  requested: boolean;
}

// RK3: the security left out the longest and its months, on one line under the verdict, with the
// action that fetches the missing prices: a history request from the first month of the report
// for each security left out, which fetches the holes of its sources (A248 CQ4b). A reader sees
// the line without the action. It draws no surface: the section is the only frame.
export function RiskCoverageNotice({
  report,
  onRequested,
  requested,
}: RiskCoverageNoticeProps) {
  const t = useT();
  const [tag] = useAppLocale();
  const api = useApi();
  const me = useQuery(meQuery(api)).data;
  const history = useRequestHistory();

  const longest = report.left_out[0];
  if (longest === undefined) return null;

  const month = (iso: string) => formatReferenceMonth(iso.slice(0, 7), tag);
  const from = `${(report.from ?? longest.from).slice(0, 7)}-01`;
  const words = {
    code: longest.instrument,
    from: month(longest.from),
    to: month(longest.to),
    others: report.left_out.length - 1,
  };

  async function handleFetch() {
    for (const l of report.left_out) {
      await history.mutateAsync({ code: l.instrument, from });
    }

    onRequested();
  }

  return (
    <Inline gap={4} align="center">
      <Text size="sm" tone="warning">
        {report.left_out.length === 1
          ? t("portfolio.risk.coverage.one", words)
          : t("portfolio.risk.coverage.many", words)}
      </Text>

      {requested && (
        <Text size="sm" tone="muted">
          {t("portfolio.risk.coverage.fetching")}
        </Text>
      )}

      {!requested && me?.book_role !== "read" && (
        <Button
          size="sm"
          variant="outline"
          tone="secondary"
          loading={history.isPending}
          onClick={() => void handleFetch()}
        >
          {t("portfolio.risk.coverage.action")}
        </Button>
      )}

      {history.isError && (
        <Text size="sm" tone="danger">
          {t("portfolio.risk.coverage.failed")}
        </Text>
      )}
    </Inline>
  );
}
