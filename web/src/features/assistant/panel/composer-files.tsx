import { AttachmentGroup } from "@slotted/react/attachment";

import { ComposerFileChip } from "@/features/assistant/panel/composer-file-chip";
import styles from "@/features/assistant/panel/composer-files.module.css";
import type { ComposerFiles as Files } from "@/features/assistant/panel/use-composer-files";
import { useT } from "@/i18n/i18n-provider";

interface ComposerFilesProps {
  files: Files;
}

// Families read: attachment. The files of the next message, one chip to a row inside the
// composer (FU2).
export function ComposerFiles({ files }: ComposerFilesProps) {
  const t = useT();

  if (files.files.length === 0) return null;

  return (
    <AttachmentGroup
      layout="grid"
      size="sm"
      aria-label={t("assistant.files.group")}
      className={styles.files}
    >
      {files.files.map((f) => (
        <ComposerFileChip
          key={f.key}
          file={f}
          onRemove={files.drop}
          onRetry={files.retry}
        />
      ))}
    </AttachmentGroup>
  );
}
