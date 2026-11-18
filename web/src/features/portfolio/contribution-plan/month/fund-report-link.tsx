import { Link } from "@slotted/react/link";
import { useQuery } from "@tanstack/react-query";
import type { ComponentPropsWithRef } from "react";

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
    // Workaround for Slotted issue #97: Button has no text-sized variant, so a button makes the
    // row taller than its siblings; the link takes the row's text size.
    <Link
      size="sm"
      render={(props) => (
        <button
          {...buttonProps(props)}
          type="button"
          className={styles.compare}
          onClick={onOpen}
        />
      )}
    >
      {t("contributionPlan.fundReport")}
    </Link>
  );
}

// The anchor props of the link, less its href, for a button: the handlers and the ref differ
// only in the element type.
function buttonProps(
  props: ComponentPropsWithRef<"a">,
): ComponentPropsWithRef<"button"> {
  const rest = { ...props };
  delete rest.href;

  return rest as ComponentPropsWithRef<"button">;
}
