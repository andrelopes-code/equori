import { useEffect } from "react";

import type { AccountDraft } from "@/features/accounts";
import type { StartRow } from "@/features/start/start-drafts";
import { writeStart } from "@/features/start/start-memory";
import type { GroupRun } from "@/features/start/use-start-run";

interface StartMemory {
  step: number;
  rows: readonly StartRow[];
  cash: boolean;
  drafts: readonly AccountDraft[];
  runs: readonly GroupRun[];
}

// A191: every change writes the walkthrough; reaching step 3 deletes it.
export function useStartMemory({
  step,
  rows,
  cash,
  drafts,
  runs,
}: StartMemory) {
  const text =
    step === 2 ? null : JSON.stringify({ step, rows, cash, drafts, runs });

  useEffect(() => {
    writeStart(text);
  }, [text]);
}
