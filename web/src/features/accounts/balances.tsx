import { ButtonLink } from "@slotted/react/button";
import { Grid } from "@slotted/react/grid";
import {
  ResultState,
  ResultStateActions,
  ResultStateContent,
  ResultStateTitle,
} from "@slotted/react/result-state";
import {
  StatCard,
  StatCardComparison,
  StatCardFigure,
  StatCardHeader,
  StatCardLabel,
  StatCardValue,
} from "@slotted/react/stat-card";

import { groupLabels } from "@/features/accounts/balance-groups";
import { BalancesPlaceholder } from "@/features/accounts/balances-placeholder";
import { useBalanceGroups } from "@/features/accounts/use-balance-groups";
import { useT } from "@/i18n/i18n-provider";
import { MoneyText } from "@/ui/money-text";
import { QueryError } from "@/ui/query-error";
import { useSpaLink } from "@/ui/use-spa-link";
import { useViewport } from "@/ui/use-viewport";

// The group totals are the page's headline: four peer cards at the desk, two by two
// below it, at the card's small step on a phone so all four fit the first screen.
export function Balances() {
  const t = useT();
  const spaLink = useSpaLink();
  const viewport = useViewport();
  const layout = {
    columns: viewport === "desktop" ? 4 : 2,
    size: viewport === "phone" ? "sm" : "md",
    minItemWidth: viewport === "phone" ? "xs" : "sm",
  } as const;
  const { groups, scale, failed, retry } = useBalanceGroups();
  if (failed) return <QueryError error={failed} onRetry={retry} />;
  if (groups === undefined) return <BalancesPlaceholder {...layout} />;
  if (groups.length === 0) {
    return (
      <ResultState status="empty" reach="section">
        <ResultStateContent>
          <ResultStateTitle>{t("home.empty")}</ResultStateTitle>
        </ResultStateContent>
        <ResultStateActions>
          <ButtonLink
            {...spaLink("/accounts")}
            tone="secondary"
            variant="outline"
          >
            {t("home.empty.action")}
          </ButtonLink>
        </ResultStateActions>
      </ResultState>
    );
  }
  return (
    <Grid
      columns={layout.columns}
      gap={viewport === "phone" ? 3 : 4}
      minItemWidth={layout.minItemWidth}
    >
      {groups.map(({ group, total, excluded }) => (
        <StatCard key={group} size={layout.size}>
          <StatCardHeader>
            <StatCardLabel>{t(groupLabels[group])}</StatCardLabel>
          </StatCardHeader>
          <StatCardFigure>
            <StatCardValue>
              <MoneyText money={total} scale={scale(total.currency)} />
            </StatCardValue>
            {excluded > 0 && (
              <StatCardComparison>
                {excluded === 1
                  ? t("home.excluded.one")
                  : t("home.excluded.other", { count: excluded })}
              </StatCardComparison>
            )}
          </StatCardFigure>
        </StatCard>
      ))}
    </Grid>
  );
}
