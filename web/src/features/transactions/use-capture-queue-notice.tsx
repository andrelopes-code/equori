import { Button } from "@slotted/react/button";
import { toast } from "@slotted/react/toast";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";

import { useApi } from "@/api/api-context";
import { meQuery } from "@/features/session";
import { readQueue } from "@/features/transactions/capture-queue";
import { useT } from "@/i18n/i18n-provider";

// P5 of ADR 022: with the server reachable, waiting texts are announced on start, on
// reconnection and when the page becomes visible.
export function useCaptureQueueNotice(): void {
  const t = useT();
  const api = useApi();
  const navigate = useNavigate();
  const id = useQuery({ ...meQuery(api), staleTime: Infinity }).data?.id;
  const shown = useRef(0);

  useEffect(() => {
    if (id === undefined) return;
    const check = () => {
      const count = readQueue(id).length;
      if (count === 0 || count === shown.current) return;
      shown.current = count;
      // One notice: a new count updates the one on screen instead of stacking a second.
      toast.show({
        id: "capture-queue",
        title: t("queue.pending", { count }),
        actions: (
          <Button
            size="sm"
            variant="ghost"
            tone="secondary"
            onClick={() => {
              void navigate({ to: "/transactions/queue" });
            }}
          >
            {t("queue.open")}
          </Button>
        ),
      });
    };
    const visible = () => {
      if (document.visibilityState === "visible") check();
    };
    check();
    window.addEventListener("online", check);
    document.addEventListener("visibilitychange", visible);
    return () => {
      window.removeEventListener("online", check);
      document.removeEventListener("visibilitychange", visible);
      // A remounted shell announces the count again.
      shown.current = 0;
    };
  }, [id, navigate, t]);
}
