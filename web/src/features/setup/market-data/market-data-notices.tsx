import {
  Alert,
  AlertActions,
  AlertContent,
  AlertDescription,
} from "@slotted/react/alert";
import { Button } from "@slotted/react/button";

import { errorText } from "@/api/problem";
import { useT } from "@/i18n/i18n-provider";

interface MarketDataNoticesProps {
  // No feed is enabled: the notice offers the sources suggested for the book's region.
  noneEnabled: boolean;
  suggestion: {
    regionName: string;
    enabling: boolean;
    onEnable: () => void;
  } | null;
  attention: boolean;
  polling: boolean;
  failure: Error | null;
}

// The notices of the pane, each a Slotted Alert (docs/contributing/web.md, O14, O15).
export function MarketDataNotices({
  noneEnabled,
  suggestion,
  attention,
  polling,
  failure,
}: MarketDataNoticesProps) {
  const t = useT();

  return (
    <>
      {noneEnabled && (
        <Alert tone="info">
          <AlertContent>
            <AlertDescription>{t("marketData.none")}</AlertDescription>
          </AlertContent>
          {suggestion !== null && (
            <AlertActions>
              <Button
                loading={suggestion.enabling}
                onClick={suggestion.onEnable}
              >
                {t("marketData.suggest", { region: suggestion.regionName })}
              </Button>
            </AlertActions>
          )}
        </Alert>
      )}

      {attention && (
        <Alert tone="warning">
          <AlertContent>
            <AlertDescription>{t("marketData.attention")}</AlertDescription>
          </AlertContent>
        </Alert>
      )}

      {polling && (
        <Alert tone="info" live="polite">
          <AlertContent>
            <AlertDescription>{t("marketData.refreshing")}</AlertDescription>
          </AlertContent>
        </Alert>
      )}

      {failure !== null && (
        <Alert tone="danger" live="polite">
          <AlertContent>
            <AlertDescription>{errorText(failure, t)}</AlertDescription>
          </AlertContent>
        </Alert>
      )}
    </>
  );
}
