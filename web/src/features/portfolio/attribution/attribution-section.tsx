import { Segment, SegmentedControl } from "@slotted/react/segmented-control";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { useApi } from "@/api/api-context";
import { attributionQuery } from "@/features/portfolio/api";
import { AttributionPending } from "@/features/portfolio/attribution/attribution-pending";
import { AttributionYearView } from "@/features/portfolio/attribution/attribution-year-view";
import { CollapsibleSection } from "@/features/portfolio/collapsible-section/collapsible-section";
import { useT } from "@/i18n/i18n-provider";
import { HelpTip } from "@/ui/display/help-tip";
import { QueryError } from "@/ui/feedback/query-error";

// shortcut: the control offers the last six years only, the width of one header line; a book with
// more years needs a select for the older ones.
const YEARS_SHOWN = 6;

const storageKey = "equori.portfolio.attribution.collapsed";

// "Quem puxou a carteira" (docs/specs/2026-11-20-portfolio-attribution-design.md): the result of
// each holding in the chosen year, the current year first. It minimizes as "Renda fixa" does. A
// book with no measured year draws nothing.
export function AttributionSection() {
  const t = useT();
  const api = useApi();
  const report = useQuery(attributionQuery(api));

  const [chosen, setChosen] = useState<number>();

  const years = (report.data?.years ?? []).slice(-YEARS_SHOWN);
  const year = years.find((y) => y.year === chosen) ?? years.at(-1);
  const title = t("portfolio.attribution.title");

  if (report.isSuccess && year === undefined) return null;

  const yearControl = years.length > 1 && year !== undefined && (
    <SegmentedControl
      size="sm"
      aria-label={t("portfolio.attribution.year")}
      value={String(year.year)}
      onValueChange={(value) => {
        setChosen(Number(value));
      }}
    >
      {years.map((y) => (
        <Segment key={y.year} value={String(y.year)}>
          {String(y.year)}
        </Segment>
      ))}
    </SegmentedControl>
  );

  return (
    <CollapsibleSection
      title={title}
      description={t("portfolio.attribution.note")}
      storageKey={storageKey}
      titleEnd={
        <HelpTip
          label={t("return.help.about", { term: title })}
          text={t("portfolio.attribution.help")}
        />
      }
      actions={yearControl === false ? undefined : yearControl}
    >
      {report.isPending && <AttributionPending />}

      {report.isError && (
        <QueryError
          error={report.error}
          onRetry={() => void report.refetch()}
        />
      )}

      {year !== undefined && <AttributionYearView year={year} />}
    </CollapsibleSection>
  );
}
