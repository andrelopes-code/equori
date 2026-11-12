import {
  ResultState,
  ResultStateContent,
  ResultStateDescription,
  ResultStateTitle,
} from "@slotted/react/result-state";

import { useT } from "@/i18n/i18n-provider";

// CA2, Q6: one empty state in place of the cards, the chart and the button of the months.
export function NetWorthEmpty() {
  const t = useT();

  return (
    <ResultState status="empty" reach="section">
      <ResultStateContent>
        <ResultStateTitle>{t("report.netWorth.empty.title")}</ResultStateTitle>
        <ResultStateDescription>
          {t("report.netWorth.empty.description")}
        </ResultStateDescription>
      </ResultStateContent>
    </ResultState>
  );
}
