import { useState } from "react";

import type { ChainTargetInput, ModelUse } from "@/features/setup/api";

// The chain of a use while the reader edits it (spec A9, A11). It starts from the targets the use
// runs, also on a default chain; `touched` says whether the reader changed it, so an untouched
// default chain is saved as the default and not as a copy of it.
export function useChainDraft(use: ModelUse) {
  const [targets, setTargets] = useState<ChainTargetInput[]>(() =>
    use.targets.map((target) => ({
      provider_id: target.provider_id,
      model: target.model,
      capabilities: target.capabilities,
    })),
  );
  const [touched, setTouched] = useState(false);

  function change(next: (current: ChainTargetInput[]) => ChainTargetInput[]) {
    setTargets(next);
    setTouched(true);
  }

  function move(from: number, to: number) {
    change((current) => {
      const next = [...current];
      const [item] = next.splice(from, 1);
      if (item !== undefined) next.splice(to, 0, item);

      return next;
    });
  }

  function remove(index: number) {
    change((current) => current.filter((_, i) => i !== index));
  }

  function add(target: ChainTargetInput) {
    change((current) => [...current, target]);
  }

  return {
    targets,
    // What a save sends: the empty list keeps a default chain the reader did not change.
    payload: use.default && !touched ? [] : targets,
    move,
    remove,
    add,
  };
}
