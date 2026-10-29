import { Button } from "@slotted/react/button";
import { toast } from "@slotted/react/toast";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { errorText } from "@/api/problem";
import type { components } from "@/api/schema.gen";
import { useRecordBatch } from "@/features/transactions/api";
import { entryOf } from "@/features/transactions/capture-draft";
import { removeQueued } from "@/features/transactions/capture-queue";
import type { QueuedCapture } from "@/features/transactions/capture-queue";
import { refusalOf } from "@/features/transactions/capture-refusal";
import type { CaptureRow } from "@/features/transactions/capture-rows";
import type { CaptureSetup } from "@/features/transactions/capture-setup";
import { useT } from "@/i18n/i18n-provider";

type Account = components["schemas"]["Account"];

interface CaptureSubmitInput {
  rows: CaptureRow[];
  setup: CaptureSetup | null;
  current: boolean;
  attention: number;
  entry: QueuedCapture | undefined;
  accountsById: Map<string, Account>;
  onRecorded: () => void;
}

// Record writes every draft in one batch or none (A114); a refused entry is named by its line.
export function useCaptureSubmit({
  rows,
  setup,
  current,
  attention,
  entry,
  accountsById,
  onRecorded,
}: CaptureSubmitInput) {
  const t = useT();
  const navigate = useNavigate();
  const record = useRecordBatch();
  const [refusal, setRefusal] = useState<{
    index: number;
    message: string;
  } | null>(null);
  const [summary, setSummary] = useState<string | null>(null);

  async function submit() {
    if (setup === null || !current || rows.length === 0 || record.isPending) {
      return;
    }

    if (attention > 0) {
      setSummary(t("capture.fix"));
      return;
    }

    setSummary(null);
    setRefusal(null);
    try {
      const batch = await record.mutateAsync(
        rows.map((r) => entryOf(r.draft, accountsById, setup.base)),
      );

      // The entry leaves the queue only once its transactions are recorded.
      if (entry !== undefined) removeQueued(entry.id);
      onRecorded();
      toast.show({
        tone: "success",
        title: t("capture.recorded", { count: batch.items.length }),
        actions: (
          <Button
            size="sm"
            variant="ghost"
            tone="secondary"
            onClick={() => {
              void navigate({ to: "/transactions" });
            }}
          >
            {t("entry.view")}
          </Button>
        ),
      });
      if (entry !== undefined) void navigate({ to: "/transactions/queue" });
    } catch (error) {
      const refused = refusalOf(error, rows);
      if (refused !== undefined) {
        setRefusal({ index: refused.index, message: refused.message });
        setSummary(
          t("capture.refused", { line: refused.line, reason: refused.message }),
        );
        return;
      }

      setSummary(errorText(error, t));
    }
  }

  function dismiss() {
    setSummary(null);
    setRefusal(null);
  }

  function dismissRefusal() {
    setRefusal(null);
  }

  return {
    submit,
    dismiss,
    dismissRefusal,
    summary,
    refusal,
    pending: record.isPending,
  };
}
