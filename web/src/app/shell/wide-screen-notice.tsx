import { ButtonLink } from "@slotted/react/button";
import {
  ResultState,
  ResultStateActions,
  ResultStateContent,
  ResultStateDescription,
  ResultStateTitle,
} from "@slotted/react/result-state";

import { useT } from "@/i18n/i18n-provider";
import { routeTo } from "@/ui/route-to";

// What a desktop-only route shows on the phone (ADR 027, S4).
export function WideScreenNotice() {
  const t = useT();

  return (
    <ResultState reach="page">
      <ResultStateContent>
        <ResultStateTitle>{t("phone.wide.title")}</ResultStateTitle>
        <ResultStateDescription>{t("phone.wide.body")}</ResultStateDescription>
      </ResultStateContent>

      <ResultStateActions>
        <ButtonLink render={routeTo({ to: "/" })}>
          {t("phone.wide.overview")}
        </ButtonLink>
      </ResultStateActions>
    </ResultState>
  );
}
