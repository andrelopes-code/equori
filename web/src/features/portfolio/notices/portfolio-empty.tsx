import { ButtonLink } from "@slotted/react/button";
import {
  ResultState,
  ResultStateContent,
  ResultStateDescription,
  ResultStateTitle,
} from "@slotted/react/result-state";

import { useT } from "@/i18n/i18n-provider";
import { routeTo } from "@/ui/navigation/route-to";

interface PortfolioEmptyProps {
  hasBrokerage: boolean;
}

// PC8, BC9: no position at the date. The first action is a buy, or a brokerage when the book has none.
export function PortfolioEmpty({ hasBrokerage }: PortfolioEmptyProps) {
  const t = useT();

  return (
    <ResultState status="empty" reach="section">
      <ResultStateContent>
        <ResultStateTitle>{t("portfolio.empty")}</ResultStateTitle>
        <ResultStateDescription>
          {t("portfolio.emptyHint")}
        </ResultStateDescription>
      </ResultStateContent>

      {hasBrokerage && (
        <ButtonLink
          render={routeTo({
            to: "/transactions/new",
            search: { kind: "trade" },
          })}
        >
          {t("holdings.trade")}
        </ButtonLink>
      )}

      {!hasBrokerage && (
        <ButtonLink
          render={routeTo({
            to: "/accounts/new",
            search: { kind: "brokerage" },
          })}
        >
          {t("brokerage.create")}
        </ButtonLink>
      )}
    </ResultState>
  );
}
