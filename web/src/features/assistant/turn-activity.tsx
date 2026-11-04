import {
  Collapsible,
  CollapsibleHeader,
  CollapsiblePanel,
  CollapsibleTrigger,
} from "@slotted/react/collapsible";
import { MessageActivity, MessageActivityStep } from "@slotted/react/message";

import { catalogKey } from "@/features/assistant/catalog-key";
import { useT } from "@/i18n/i18n-provider";

// Families read: message (activity), collapsible. The steps of a turn in order: while it runs
// the last one is current; after the answer they fold into one line that opens them (P5).
export function TurnActivity({
  steps,
  running,
}: {
  steps: string[];
  running: boolean;
}) {
  const t = useT();
  const labels = steps.flatMap((s) => {
    const key = catalogKey(`assistant.step.${s}`);
    return key === undefined ? [] : [t(key)];
  });
  if (labels.length === 0) return null;

  if (running) {
    return (
      <MessageActivity>
        {labels.map((label, i) => (
          <MessageActivityStep
            key={i}
            status={i === labels.length - 1 ? "current" : "complete"}
          >
            {label}
          </MessageActivityStep>
        ))}
      </MessageActivity>
    );
  }

  const summary = t("assistant.activity.summary", { count: labels.length });

  return (
    <Collapsible size="sm">
      <CollapsibleHeader>
        <CollapsibleTrigger>{summary}</CollapsibleTrigger>
      </CollapsibleHeader>
      <CollapsiblePanel>
        <MessageActivity>
          {labels.map((label, i) => (
            <MessageActivityStep key={i} status="complete">
              {label}
            </MessageActivityStep>
          ))}
        </MessageActivity>
      </CollapsiblePanel>
    </Collapsible>
  );
}
