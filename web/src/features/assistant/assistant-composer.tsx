import { Icon } from "@slotted/react/icon";
import {
  PromptComposer,
  PromptComposerAction,
  PromptComposerFooter,
  PromptComposerInput,
  PromptComposerSubmit,
} from "@slotted/react/prompt-composer";
import { Text } from "@slotted/react/typography";
import { useState } from "react";

import { AssistantIcon } from "@/features/assistant/assistant-icon";
import styles from "@/features/assistant/assistant-panel.module.css";
import { useSpeechInput } from "@/features/assistant/use-speech-input";
import { useAppLocale, useT } from "@/i18n/i18n-provider";

// Families read: prompt-composer, icon, typography. The field keeps what the reader typed or
// dictated until a send is accepted; a send while a turn runs is refused and the text stays.
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
  const [locale] = useAppLocale();
  const [value, setValue] = useState("");
  // Workaround for Slotted finding "The prompt composer has no dictation action": the panel runs the browser's speech recognition and draws the microphone itself.
  const speech = useSpeechInput(locale, (text) => {
    setValue((current) =>
      current.trim() === "" ? text : `${current} ${text}`,
    );
  });

  return (
    <PromptComposer
      value={value}
      onValueChange={(next) => {
        setValue(next);
      }}
      disabled={disabled}
      status={busy ? "submitted" : "ready"}
      emphasis="ring"
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
        {speech.supported && (
          <PromptComposerAction
            aria-label={
              speech.listening
                ? t("assistant.voice.stop")
                : t("assistant.voice.start")
            }
            aria-pressed={speech.listening}
            disabled={disabled}
            onClick={speech.toggle}
          >
            <Icon>
              <AssistantIcon name="mic" />
            </Icon>
          </PromptComposerAction>
        )}
        <Text
          size="xs"
          tone={speech.listening ? "accent" : "muted"}
          className={styles.hint}
          data-listening={speech.listening || undefined}
          aria-live="polite"
        >
          {speech.listening
            ? t("assistant.voice.listening")
            : t("assistant.composer.hint")}
        </Text>
        <PromptComposerSubmit />
      </PromptComposerFooter>
    </PromptComposer>
  );
}
