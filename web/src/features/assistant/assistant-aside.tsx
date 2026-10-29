import {
  AppShellAside,
  AppShellAsideBody,
  AppShellAsideFooter,
  AppShellAsideHeader,
  AppShellAsideResizer,
} from "@slotted/react/app-shell";
import { Heading, Text } from "@slotted/react/typography";
import type { KeyboardEvent, ReactNode } from "react";

import styles from "@/features/assistant/assistant-panel.module.css";
import { useT } from "@/i18n/i18n-provider";

interface AssistantAsideProps {
  title: string;
  actions: ReactNode;
  body: ReactNode;
  footer: ReactNode;
  onClose: () => void;
}

// The assistant as the shell's pane beside the page, from 1200 px (P9).
export function AssistantAside({
  title,
  actions,
  body,
  footer,
  onClose,
}: AssistantAsideProps) {
  const t = useT();

  // An inline pane is not a layer, so the shell leaves Escape alone; the assistant closes on it.
  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === "Escape" && !event.defaultPrevented) onClose();
  }

  return (
    <AppShellAside style={{ minWidth: "30vw" }} onKeyDown={handleKeyDown}>
      <AppShellAsideResizer />

      <AppShellAsideHeader>
        {/* One child: the pane's header gives each child of its own an equal share of the row. */}
        <div className={styles.asideHeader}>
          <div className={styles.asideTitle}>
            <Heading level={2} size="md">
              {t("assistant.title")}
            </Heading>
            <Text size="sm" tone="muted" truncate>
              {title}
            </Text>
          </div>
          {actions}
        </div>
      </AppShellAsideHeader>

      <AppShellAsideBody>{body}</AppShellAsideBody>

      {footer !== null && <AppShellAsideFooter>{footer}</AppShellAsideFooter>}
    </AppShellAside>
  );
}
