import {
  Alert,
  AlertActions,
  AlertContent,
  AlertDescription,
} from "@slotted/react/alert";
import { Button } from "@slotted/react/button";
import { Inline } from "@slotted/react/inline";
import { Loader } from "@slotted/react/progress-indicator";
import { Text } from "@slotted/react/typography";

import type { HistoryState } from "@/features/instruments/coverage-line";
import { formatDate } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";

interface HistoryNoticeProps {
  history: HistoryState;
  retrying: boolean;
  onRetry: () => void;
}

// A223 RM10: a history under way shows a loader beside its sentence; a failed one is one alert
// that holds its retry. Nothing is drawn while the history is idle.
export function HistoryNotice({
  history,
  retrying,
  onRetry,
}: HistoryNoticeProps) {
  const t = useT();
  const [locale] = useAppLocale();

  if (history.kind === "idle") return null;

  const from = formatDate(history.from, locale);

  if (history.kind === "loading")
    return (
      <Inline gap={2} align="center" aria-busy>
        <Loader size="sm" decorative />
        <Text tone="muted">{t("instruments.history.loading", { from })}</Text>
      </Inline>
    );

  return (
    <Alert tone="danger">
      <AlertContent>
        <AlertDescription>
          {t("instruments.history.failed", { from, error: history.error })}
        </AlertDescription>
      </AlertContent>
      <AlertActions>
        <Button loading={retrying} onClick={onRetry}>
          {t("instruments.history.retry")}
        </Button>
      </AlertActions>
    </Alert>
  );
}
