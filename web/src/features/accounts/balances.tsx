import { ButtonLink } from "@slotted/react/button";
import {
  ResultState,
  ResultStateActions,
  ResultStateContent,
  ResultStateTitle,
} from "@slotted/react/result-state";

import { groupLabels } from "@/features/accounts/balance-groups";
import { BalancesPlaceholder } from "@/features/accounts/balances-placeholder";
import { useBalanceGroups } from "@/features/accounts/use-balance-groups";
import { useT } from "@/i18n/i18n-provider";
import { FigureStrip } from "@/ui/figure-strip";
import { FigureStripItem } from "@/ui/figure-strip-item";
import { MoneyFigure } from "@/ui/money-figure";
import { QueryError } from "@/ui/query-error";
import { useSpaLink } from "@/ui/use-spa-link";
import { useViewport } from "@/ui/use-viewport";

// Ledger sheet L12: the group totals are the page's headline, one strip of figures
// separated by rules; the strip folds to two by two on a narrow page.
export function Balances() {
  const t = useT();
  const spaLink = useSpaLink();
  const viewport = useViewport();
  const { groups, scale, failed, retry } = useBalanceGroups();
  if (failed) return <QueryError error={failed} onRetry={retry} />;
  if (groups === undefined) return <BalancesPlaceholder />;
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
    <FigureStrip label={t("home.balances")}>
      {groups.map(({ group, total, excluded }) => (
        <FigureStripItem
          key={group}
          label={t(groupLabels[group])}
          caption={
            excluded === 0
              ? undefined
              : excluded === 1
                ? t("home.excluded.one")
                : t("home.excluded.other", { count: excluded })
          }
        >
          <MoneyFigure
            money={total}
            scale={scale(total.currency)}
            size={viewport === "phone" ? "lg" : "xl"}
          />
        </FigureStripItem>
      ))}
    </FigureStrip>
  );
}
