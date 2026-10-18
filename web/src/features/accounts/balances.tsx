import { ButtonLink } from "@slotted/react/button";
import { Grid } from "@slotted/react/grid";
import { List } from "@slotted/react/list";
import {
  ListItem,
  ListItemBody,
  ListItemContent,
  ListItemDescription,
  ListItemEnd,
  ListItemLabel,
} from "@slotted/react/list-item";
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

// The group totals: peer stat cards at the desk, one list of rows on a phone (OV-02).
export function Balances() {
  const t = useT();
  const spaLink = useSpaLink();
  const viewport = useViewport();
  const phone = viewport === "phone";
  // Two by two below the desk, so four groups never leave one card alone on a row.
  const columns = viewport === "desktop" ? 4 : 2;
  const { groups, scale, failed, retry } = useBalanceGroups();
  if (failed) return <QueryError error={failed} onRetry={retry} />;
  if (groups === undefined) {
    return <BalancesPlaceholder phone={phone} columns={columns} />;
  }
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
  if (phone) {
    return (
      <List variant="ruled" aria-label={t("home.balances")}>
        {groups.map(({ group, total, excluded }) => (
          <ListItem key={group}>
            <ListItemContent>
              <ListItemBody>
                <ListItemLabel>{t(groupLabels[group])}</ListItemLabel>
                {excluded > 0 && (
                  <ListItemDescription>
                    {t("home.excluded", { count: excluded })}
                  </ListItemDescription>
                )}
              </ListItemBody>
              <ListItemEnd>
                <MoneyText
                  money={total}
                  scale={scale(total.currency)}
                  tone="balance"
                />
              </ListItemEnd>
            </ListItemContent>
          </ListItem>
        ))}
      </List>
    );
  }
  return (
    <Grid columns={columns} gap={4} minItemWidth="sm">
      {groups.map(({ group, total, excluded }) => (
        <StatCard key={group}>
          <StatCardHeader>
            <StatCardLabel>{t(groupLabels[group])}</StatCardLabel>
          </StatCardHeader>
          <StatCardFigure>
            <StatCardValue>
              <MoneyText
                money={total}
                scale={scale(total.currency)}
                tone="balance"
              />
            </StatCardValue>
            {excluded > 0 && (
              <StatCardComparison>
                {t("home.excluded", { count: excluded })}
              </StatCardComparison>
            )}
          </StatCardFigure>
        </StatCard>
      ))}
    </Grid>
  );
}
