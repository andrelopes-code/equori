import {
  ResultState,
  ResultStateContent,
  ResultStateDescription,
  ResultStateTitle,
} from "@slotted/react/result-state";

import { useT } from "@/i18n/i18n-provider";

// PX3: what is missing, under the plan section; nothing else is drawn below.
export function ProjectionNobirth() {
  const t = useT();

  return (
    <ResultState status="empty" reach="section">
      <ResultStateContent>
        <ResultStateTitle>
          {t("portfolio.projection.nobirth.title")}
        </ResultStateTitle>
        <ResultStateDescription>
          {t("portfolio.projection.nobirth.description")}
        </ResultStateDescription>
      </ResultStateContent>
    </ResultState>
  );
}
