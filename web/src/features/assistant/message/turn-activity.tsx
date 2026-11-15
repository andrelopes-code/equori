import {
  Collapsible,
  CollapsibleHeader,
  CollapsiblePanel,
} from "@slotted/react/collapsible";

import { distinctSteps } from "@/features/assistant/message/distinct-steps";
import { SourcePill } from "@/features/assistant/message/source-pill";
import {
  SourceSteps,
  type SourceEntry,
} from "@/features/assistant/message/source-steps";
import { catalogKey } from "@/features/assistant/model/catalog-key";
import { useT } from "@/i18n/i18n-provider";

interface TurnActivityProps {
  steps: string[];
  running: boolean;
}

// Families read: collapsible. The sources of a turn, each once: while it runs the last one is
// current; after the answer they fold into one line that opens them (P5).
export function TurnActivity({ steps, running }: TurnActivityProps) {
  const t = useT();
  const entries = distinctSteps(steps).flatMap((tool): SourceEntry[] => {
    const key = catalogKey(`assistant.step.${tool}`);
    return key === undefined ? [] : [{ tool, label: t(key) }];
  });
  if (entries.length === 0) return null;

  if (running) return <SourceSteps entries={entries} running />;

  const summary = t("assistant.activity.summary", { count: entries.length });

  return (
    <Collapsible size="sm">
      <CollapsibleHeader>
        <SourcePill entries={entries} summary={summary} />
      </CollapsibleHeader>

      <CollapsiblePanel>
        <SourceSteps entries={entries} running={false} />
      </CollapsiblePanel>
    </Collapsible>
  );
}
