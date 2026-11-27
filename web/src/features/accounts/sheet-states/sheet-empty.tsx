import { Button } from "@slotted/react/button";
import {
  ResultState,
  ResultStateActions,
  ResultStateContent,
  ResultStateDescription,
  ResultStateTitle,
} from "@slotted/react/result-state";
import { useNavigate } from "@tanstack/react-router";

import { useT } from "@/i18n/i18n-provider";
import { useServed } from "@/ui/navigation/use-served";

const newAccount = { to: "/accounts/new" } as const;

// A book with no account: the sentence and, where the route is served, the first account.
export function SheetEmpty() {
  const t = useT();
  const navigate = useNavigate();
  const served = useServed();

  return (
    <ResultState status="empty" reach="section">
      <ResultStateContent>
        <ResultStateTitle>{t("balanceSheet.empty")}</ResultStateTitle>
        <ResultStateDescription>
          {t("balanceSheet.emptyHint")}
        </ResultStateDescription>
      </ResultStateContent>

      {served(newAccount) && (
        <ResultStateActions>
          <Button
            onClick={() => {
              void navigate(newAccount);
            }}
          >
            {t("balanceSheet.new")}
          </Button>
        </ResultStateActions>
      )}
    </ResultState>
  );
}
