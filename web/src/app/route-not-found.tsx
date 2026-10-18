import {
  ResultState,
  ResultStateContent,
  ResultStateTitle,
} from "@slotted/react/result-state";

import { useT } from "@/i18n/i18n-provider";

export function RouteNotFound() {
  const t = useT();
  return (
    <ResultState status="not-found" reach="section">
      <ResultStateContent>
        <ResultStateTitle>{t("common.notFound.title")}</ResultStateTitle>
      </ResultStateContent>
    </ResultState>
  );
}
