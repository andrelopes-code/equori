import {
  Alert,
  AlertContent,
  AlertDescription,
  AlertTitle,
} from "@slotted/react/alert";

import { ImportCountTags } from "@/features/accounts/import-count-tags";
import type { SyncOutcome } from "@/features/accounts/use-sync-now";
import { useT } from "@/i18n/i18n-provider";

interface SyncResultProps {
  outcome: SyncOutcome | null;
}

// What the last "sync now" did: the lines it brought in, or why nothing came.
export function SyncResult({ outcome }: SyncResultProps) {
  const t = useT();

  if (outcome === null) {
    return null;
  }

  if (outcome.kind === "synced") {
    const { created, matched, needs_review, updated, withdrawn } =
      outcome.counts;
    const empty = created + matched + needs_review + updated + withdrawn === 0;

    return (
      <Alert tone="success" live="polite">
        <AlertContent>
          <AlertTitle>{t("sync.result.title")}</AlertTitle>
          <AlertDescription>
            {empty ? (
              t("sync.result.nothing")
            ) : (
              <ImportCountTags counts={outcome.counts} />
            )}
          </AlertDescription>
        </AlertContent>
      </Alert>
    );
  }

  const failed = outcome.kind === "failed";

  return (
    <Alert
      tone={failed ? "danger" : "warning"}
      live={failed ? "assertive" : "polite"}
    >
      <AlertContent>
        <AlertTitle>
          {failed ? t("sync.result.failed") : t("sync.result.notSynced")}
        </AlertTitle>
        <AlertDescription>{outcome.text}</AlertDescription>
      </AlertContent>
    </Alert>
  );
}
