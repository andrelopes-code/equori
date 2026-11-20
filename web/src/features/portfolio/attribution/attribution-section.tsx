import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { useApi } from "@/api/api-context";
import { attributionQuery } from "@/features/portfolio/api";
import styles from "@/features/portfolio/attribution/attribution.module.css";
import { AttributionPending } from "@/features/portfolio/attribution/attribution-pending";
import { AttributionYearView } from "@/features/portfolio/attribution/attribution-year-view";
import { YearChart } from "@/features/portfolio/attribution/year-chart";
import { CollapsibleSection } from "@/features/portfolio/collapsible-section/collapsible-section";
import { useT } from "@/i18n/i18n-provider";
import { HelpTip } from "@/ui/display/help-tip";
import { QueryError } from "@/ui/feedback/query-error";

const storageKey = "equori.portfolio.attribution.collapsed";

// "Quem puxou a carteira" (docs/specs/2026-11-20-portfolio-attribution-design.md): the return of
// each year as a chart of every year, then the share of each holding in the chosen year, the current year
// first. It minimizes as "Renda fixa" does. A book with no measured year draws nothing.
export function AttributionSection() {
  const t = useT();
  const api = useApi();
  const report = useQuery(attributionQuery(api));

  const [chosen, setChosen] = useState<number>();

  const years = report.data?.years ?? [];
  const year = years.find((y) => y.year === chosen) ?? years.at(-1);
  const title = t("portfolio.attribution.title");

  if (report.isSuccess && year === undefined) return null;

  return (
    <CollapsibleSection
      title={title}
      description={t("portfolio.attribution.note")}
      storageKey={storageKey}
      actions={
        <HelpTip
          label={t("return.help.about", { term: title })}
          text={t("portfolio.attribution.help")}
        />
      }
    >
      {report.isPending && <AttributionPending />}

      {report.isError && (
        <QueryError
          error={report.error}
          onRetry={() => void report.refetch()}
        />
      )}

      {year !== undefined && (
        <div className={styles.layout}>
          {years.length > 1 && (
            <YearChart years={years} chosen={year.year} onChoose={setChosen} />
          )}

          <AttributionYearView year={year} />
        </div>
      )}
    </CollapsibleSection>
  );
}
