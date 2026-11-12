import { ButtonLink } from "@slotted/react/button";
import {
  ResultState,
  ResultStateContent,
  ResultStateTitle,
} from "@slotted/react/result-state";

import { useT } from "@/i18n/i18n-provider";
import { routeTo } from "@/ui/navigation/route-to";

interface PositionsEmptyProps {
  brokerageID: string;
}

// BC9: a brokerage without investments offers its first purchase, with this brokerage preset.
export function PositionsEmpty({ brokerageID }: PositionsEmptyProps) {
  const t = useT();

  return (
    <ResultState status="empty">
      <ResultStateContent>
        <ResultStateTitle>{t("positions.empty")}</ResultStateTitle>
      </ResultStateContent>
      <ButtonLink
        render={routeTo({
          to: "/transactions/new",
          search: { kind: "trade", brokerage_id: brokerageID },
        })}
      >
        {t("positions.recordBuy")}
      </ButtonLink>
    </ResultState>
  );
}
