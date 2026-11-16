import { Button } from "@slotted/react/button";
import { Inline } from "@slotted/react/inline";
import { Loader } from "@slotted/react/progress-indicator";

import { useT } from "@/i18n/i18n-provider";

interface MarketDataToolbarProps {
  admin: boolean;
  // A run or a history load is pending: the loader shows beside the action.
  working: boolean;
  refreshDisabled: boolean;
  refreshing: boolean;
  onRefresh: () => void;
}

// What acts on every enabled feed: the refresh, and the loader while a run or a history is pending.
export function MarketDataToolbar({
  admin,
  working,
  refreshDisabled,
  refreshing,
  onRefresh,
}: MarketDataToolbarProps) {
  const t = useT();

  if (!admin && !working) return null;

  return (
    <Inline gap={3} align="center" justify="end">
      {working && <Loader size="sm" aria-label={t("marketData.working")} />}

      {admin && (
        <Button
          variant="outline"
          tone="secondary"
          disabled={refreshDisabled}
          loading={refreshing}
          onClick={onRefresh}
        >
          {t("marketData.refresh")}
        </Button>
      )}
    </Inline>
  );
}
