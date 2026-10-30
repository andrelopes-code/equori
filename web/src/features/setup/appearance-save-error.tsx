import { Alert, AlertContent, AlertDescription } from "@slotted/react/alert";
import { useMutationState } from "@tanstack/react-query";

import { ProblemError, problemMessage } from "@/api/problem";
import { appearanceSaveKey } from "@/features/session";
import { useT } from "@/i18n/i18n-provider";

export function AppearanceSaveError() {
  const t = useT();
  const errors = useMutationState({
    filters: { mutationKey: appearanceSaveKey },
    select: (mutation) => mutation.state.error,
  });

  const error = errors.at(-1);

  if (!(error instanceof ProblemError)) return null;

  return (
    <Alert tone="danger">
      <AlertContent>
        <AlertDescription>{problemMessage(error.problem, t)}</AlertDescription>
      </AlertContent>
    </Alert>
  );
}
