import {
  PromptComposer,
  PromptComposerAttach,
  PromptComposerFooter,
  PromptComposerInput,
  PromptComposerSubmit,
} from "@slotted/react/prompt-composer";
import { Text } from "@slotted/react/typography";
import type { RefObject } from "react";

import type { components } from "@/api/schema.gen";
import type { AssistantFile } from "@/features/assistant/api";
import styles from "@/features/assistant/panel/assistant-panel.module.css";
import { ComposerFiles } from "@/features/assistant/panel/composer-files";
import filesStyles from "@/features/assistant/panel/composer-files.module.css";
import { filesLine } from "@/features/assistant/panel/files-line";
import type { ComposerFiles as Files } from "@/features/assistant/panel/use-composer-files";
import { useT } from "@/i18n/i18n-provider";

// F3 and F2: the kinds the server reads, at most 10 MiB each and 5 to a message. image/* lets a
// phone's picker offer the camera (FU1).
const accept = ".ofx,.qfx,.csv,.txt,.pdf,text/*,application/pdf,image/*";
const maxSize = 10 * 1024 * 1024;
const maxFiles = 5;

interface AssistantComposerProps {
  disabled: boolean;
  busy: boolean;
  chat: components["schemas"]["AssistantChat"] | undefined;
  files: Files;
  onSend: (text: string, files: AssistantFile[]) => void;
  onStop: () => void;
  inputRef?: RefObject<HTMLTextAreaElement | null>;
  value: string;
  onValueChange: (value: string) => void;
}

// Families read: prompt-composer, typography. The field keeps what the reader typed until a send
// is accepted; a send while a turn runs is refused, and canSubmit refuses one while a file
// uploads (FU3); the text stays.
export function AssistantComposer({
  disabled,
  busy,
  chat,
  files,
  onSend,
  onStop,
  inputRef,
  value,
  onValueChange,
}: AssistantComposerProps) {
  const t = useT();

  const line = filesLine(
    files.stored.map((f) => f.kind),
    chat?.provider_name,
    chat?.reads_files ?? false,
  );
  const ready = files.stored.length > 0 && !files.uploading;

  return (
    <PromptComposer
      value={value}
      onValueChange={(next) => {
        onValueChange(next);
      }}
      disabled={disabled}
      status={busy ? "streaming" : "ready"}
      onStop={onStop}
      emphasis="ring"
      className={styles.ring}
      canSubmit={files.uploading ? false : ready || undefined}
      accept={accept}
      maxSize={maxSize}
      maxFiles={maxFiles}
      onAttach={(added, { rejected }) => {
        files.add(added, rejected);
      }}
      messages={{
        send: t("assistant.composer.send"),
        stop: t("assistant.composer.stop"),
      }}
      onValueSubmit={(next, request) => {
        if (busy || (next.trim() === "" && !ready)) {
          request.cancel();
          return;
        }

        onSend(next.trim(), files.stored);
        files.clear();
      }}
    >
      <ComposerFiles files={files} />
      <PromptComposerInput
        ref={inputRef}
        aria-label={t("assistant.composer.placeholder")}
        placeholder={t("assistant.composer.placeholder")}
        maxLength={4000}
        maxRows={6}
      />
      {line !== null && (
        <Text size="xs" tone="muted" className={filesStyles.line}>
          {t(line.key, { provider: line.provider })}
        </Text>
      )}
      <PromptComposerFooter>
        <PromptComposerAttach />
        <Text size="xs" tone="muted" className={styles.hint}>
          {t("assistant.composer.hint")}
        </Text>
        <PromptComposerSubmit />
      </PromptComposerFooter>
    </PromptComposer>
  );
}
