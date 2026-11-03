import {
  Collapsible,
  CollapsibleHeader,
  CollapsiblePanel,
  CollapsibleTrigger,
} from "@slotted/react/collapsible";
import { Glyph, Icon } from "@slotted/react/icon";
import { List } from "@slotted/react/list";
import {
  ListItem,
  ListItemBody,
  ListItemContent,
  ListItemLabel,
  ListItemStart,
} from "@slotted/react/list-item";
import { MessageActivity, MessageActivityStep } from "@slotted/react/message";

import { catalogKey } from "@/features/assistant/catalog-key";
import { useT } from "@/i18n/i18n-provider";

// Families read: message (activity), collapsible, list. The steps of a turn in order: while it runs
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
        {/* Workaround for Slotted issue #61: MessageActivity draws unstyled inside a Collapsible,
            so the folded steps are a List of ticks. */}
        <List size="sm" inset aria-label={summary}>
          {labels.map((label, i) => (
            <ListItem key={i}>
              <ListItemContent>
                <ListItemStart>
                  <Icon size="sm" tone="success">
                    <Glyph name="check" />
                  </Icon>
                </ListItemStart>
                <ListItemBody>
                  <ListItemLabel>{label}</ListItemLabel>
                </ListItemBody>
              </ListItemContent>
            </ListItem>
          ))}
        </List>
      </CollapsiblePanel>
    </Collapsible>
  );
}
