import { ProgressBar } from "@slotted/react/progress-indicator";
import { useQuery } from "@tanstack/react-query";

import { useApi } from "@/api/api-context";
import { OverviewBlock } from "@/features/overview/overview-block";
import { OverviewRows } from "@/features/overview/overview-rows";
import { useBase } from "@/features/overview/use-base";
import { goalsQuery } from "@/features/planning";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";
import { useMediaQuery, wideQuery } from "@/ui/use-media-query";

export function GoalsBlock() {
  const t = useT();
  const api = useApi();
  const fmt = useMoneyFormat();
  const [locale] = useAppLocale();
  const { scale } = useBase();
  const wide = useMediaQuery(wideQuery);
  const goals = useQuery(goalsQuery(api));
  const loading = goals.data === undefined || scale === null;
  const percent = new Intl.NumberFormat(locale, {
    style: "percent",
    maximumFractionDigits: 0,
  });
  const rows =
    loading || goals.error !== null
      ? []
      : goals.data.map((goal) => ({
          key: goal.id,
          title: goal.name,
          line: (
            <>
              {t("overview.goals.of", {
                current: fmt.money(goal.current, scale(goal.current.currency)),
                target: fmt.money(goal.target, scale(goal.target.currency)),
              })}
              {wide && (
                <ProgressBar
                  size="sm"
                  hideLabel
                  label={goal.name}
                  value={goal.progress_bp / 100}
                />
              )}
            </>
          ),
          end: percent.format(goal.progress_bp / 10000),
        }));
  return (
    <OverviewBlock
      title={t("overview.goals.title")}
      link={{ label: t("overview.goals.open"), options: { to: "/goals" } }}
      loading={loading && goals.error === null}
      error={goals.error}
      onRetry={() => void goals.refetch()}
      empty={rows.length === 0 ? t("overview.goals.empty") : undefined}
    >
      <OverviewRows label={t("overview.goals.title")} rows={rows} />
    </OverviewBlock>
  );
}
