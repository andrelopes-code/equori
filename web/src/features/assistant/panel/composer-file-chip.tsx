import {
  Attachment,
  AttachmentAction,
  AttachmentActions,
  AttachmentBody,
  AttachmentDetail,
  AttachmentFilename,
  AttachmentMessage,
  AttachmentPreview,
  AttachmentProgress,
  AttachmentRemove,
} from "@slotted/react/attachment";
import { Glyph, Icon } from "@slotted/react/icon";

import type { ComposerFile } from "@/features/assistant/panel/use-composer-files";
import { useT } from "@/i18n/i18n-provider";

interface ComposerFileChipProps {
  file: ComposerFile;
  onRemove: (key: string) => void;
  onRetry: (key: string) => void;
}

// Families read: attachment, icon. One file of the composer: its upload, its stored state or its
// cause of failure with a retry (FU2, FU3).
export function ComposerFileChip({
  file,
  onRemove,
  onRetry,
}: ComposerFileChipProps) {
  const t = useT();

  const failed = file.failure !== undefined;
  // A wrong kind or size fails again; a broken upload or a full conversation may pass later.
  const retryable =
    file.failure === "assistant.files.failed.network" ||
    file.failure === "assistant.files.failed.full";

  return (
    <Attachment
      file={file.file}
      invalid={failed}
      loading={file.progress !== null}
      onRemove={() => {
        onRemove(file.key);
      }}
    >
      <AttachmentPreview />
      <AttachmentBody>
        <AttachmentFilename />
        {file.failure !== undefined && (
          <AttachmentMessage>{t(file.failure)}</AttachmentMessage>
        )}
        {!failed && <AttachmentDetail />}
        {file.progress !== null && <AttachmentProgress value={file.progress} />}
      </AttachmentBody>
      <AttachmentActions>
        {retryable && (
          <AttachmentAction
            aria-label={t("assistant.files.retry", { name: file.file.name })}
            onClick={() => {
              onRetry(file.key);
            }}
          >
            <Icon>
              <Glyph name="upload" />
            </Icon>
          </AttachmentAction>
        )}
        <AttachmentRemove />
      </AttachmentActions>
    </Attachment>
  );
}
