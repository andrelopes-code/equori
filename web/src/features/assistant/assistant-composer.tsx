import {
  PromptComposer,
  PromptComposerFooter,
  PromptComposerInput,
  PromptComposerSubmit,
} from "@slotted/react/prompt-composer";
import { Text } from "@slotted/react/typography";
import { useState } from "react";

import styles from "@/features/assistant/assistant-panel.module.css";
import { useT } from "@/i18n/i18n-provider";

// Families read: prompt-composer, typography. The field keeps what the reader typed until a send is accepted; a send while a turn runs is refused and the text stays.
export function AssistantComposer({
  disabled,
  busy,
  onSend,
}: {
  disabled: boolean;
  busy: boolean;
  onSend: (text: string) => void;
}) {
  const t = useT();
  const [value, setValue] = useState("");
  return (
    <div className={styles.halo} data-busy={busy || undefined}>
      <PromptComposer
        value={value}
        onValueChange={(next) => {
          setValue(next);
        }}
        disabled={disabled}
        status={busy ? "submitted" : "ready"}
        emphasis="ring"
        className={styles.ring}
        messages={{ send: t("assistant.composer.send") }}
        onValueSubmit={(next, request) => {
          if (busy || next.trim() === "") {
            request.cancel();
            return;
          }
          onSend(next.trim());
        }}
      >
        <PromptComposerInput
          aria-label={t("assistant.composer.placeholder")}
          placeholder={t("assistant.composer.placeholder")}
          maxLength={4000}
          maxRows={6}
        />
        <PromptComposerFooter>
          <Text size="xs" tone="muted" className={styles.hint}>
            {t("assistant.composer.hint")}
          </Text>
          <PromptComposerSubmit />
        </PromptComposerFooter>
      </PromptComposer>
    </div>
  );
}
