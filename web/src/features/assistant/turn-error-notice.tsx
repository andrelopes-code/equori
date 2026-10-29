import {
  Alert,
  AlertContent,
  AlertDescription,
  AlertTitle,
} from "@slotted/react/alert";

import { problemMessage } from "@/api/problem";
import type { AssistantProblem } from "@/features/assistant/sse";
import { useT } from "@/i18n/i18n-provider";

// The chat state answers these codes; the stored conversation shows a failed turn (P6, P7).
const stateCodes = new Set([
  "assistant_exhausted",
  "assistant_unavailable",
  "assistant_failed",
]);

export function TurnErrorNotice({ error }: { error: AssistantProblem | null }) {
  const t = useT();

  if (error === null || stateCodes.has(error.code)) return null;

  return (
    <Alert tone="danger" live="polite">
      <AlertContent>
        <AlertTitle>{t("assistant.failed.title")}</AlertTitle>
        <AlertDescription>{problemMessage(error, t)}</AlertDescription>
      </AlertContent>
    </Alert>
  );
}
