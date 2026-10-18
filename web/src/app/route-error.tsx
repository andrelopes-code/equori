import { useRouter } from "@tanstack/react-router";
import type { ErrorComponentProps } from "@tanstack/react-router";

import { QueryError } from "@/ui/query-error";

export function RouteError({ error }: ErrorComponentProps) {
  const router = useRouter();
  return (
    <QueryError
      error={error instanceof Error ? error : new Error(String(error))}
      onRetry={() => {
        void router.invalidate();
      }}
    />
  );
}
