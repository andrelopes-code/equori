import { Button } from "@slotted/react/button";
import { useQuery } from "@tanstack/react-query";

import { useApi } from "@/api/api-context";
import { fundReportsQuery } from "@/features/instruments";
import styles from "@/features/portfolio/contribution-plan/month/purchase-row.module.css";
import { useT } from "@/i18n/i18n-provider";

interface FundReportLinkProps {
  code: string;
  onOpen: () => void;
}

// The button that opens the fund report of an instrument; nothing while the fund has no report.
export function FundReportLink({ code, onOpen }: FundReportLinkProps) {
  const t = useT();
  const api = useApi();
  const reports = useQuery(fundReportsQuery(api, code)).data;

  if (reports === undefined || reports.length === 0) return null;

  return (
    <Button inline size="sm" className={styles.compare} onClick={onOpen}>
      {t("contributionPlan.fundReport")}
    </Button>
  );
}
