import { Button } from "@slotted/react/button";
import { Icon } from "@slotted/react/icon";
import { Stack } from "@slotted/react/stack";
import { Heading, Text } from "@slotted/react/typography";
import type { ReactNode } from "react";

import { AssistantIcon } from "@/features/assistant/assistant-icon";
import styles from "@/features/assistant/assistant-panel.module.css";
import { useT } from "@/i18n/i18n-provider";
import type { MessageKey } from "@/i18n/catalog.en";

// Families read: typography, button, stack. A conversation without messages: what the
// assistant does, three questions to start from, and the notices before anything is sent.
export function ChatWelcome({
  notices,
  canAsk,
  onAsk,
  suggestions,
}: {
  notices: ReactNode;
  // The questions for the current screen (P20).
  suggestions: readonly MessageKey[];
  canAsk: boolean;
  onAsk: (text: string) => void;
}) {
  const t = useT();
  return (
    <Stack gap={6} className={styles.welcome}>
      <Stack gap={3} align="center">
        <span className={styles.mark}>
          <Icon size="lg">
            <AssistantIcon name="spark" />
          </Icon>
        </span>
        <Heading level={3} size="lg" align="center">
          {t("assistant.welcome.title")}
        </Heading>
        <Text tone="muted" align="center" wrap="pretty">
          {t("assistant.welcome.body")}
        </Text>
      </Stack>
      {canAsk && (
        <Stack gap={2}>
          {suggestions.map((key) => (
            <Button
              key={key}
              variant="outline"
              tone="secondary"
              fullWidth
              onClick={() => {
                onAsk(t(key));
              }}
            >
              {t(key)}
            </Button>
          ))}
        </Stack>
      )}
      {notices}
    </Stack>
  );
}
