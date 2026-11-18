import {
  Attachment,
  AttachmentBody,
  AttachmentDetail,
  AttachmentFilename,
  AttachmentGroup,
  AttachmentLink,
  AttachmentPreview,
} from "@slotted/react/attachment";

import { assistantFileUrl } from "@/features/assistant/api";
import type { AssistantFile } from "@/features/assistant/api";
import styles from "@/features/assistant/message/sent-files.module.css";
import { useT } from "@/i18n/i18n-provider";

interface SentFilesProps {
  files: AssistantFile[];
}

// The server opens these kinds in place; a statement or a CSV is a download, not a reading.
const opens = new Set<AssistantFile["kind"]>(["pdf", "image", "text"]);

// Families read: attachment. The files a sent message carried; a pdf, an image or a text opens
// in a new tab (FU5).
export function SentFiles({ files }: SentFilesProps) {
  const t = useT();

  if (files.length === 0) return null;

  return (
    <AttachmentGroup
      layout="list"
      size="sm"
      aria-label={t("assistant.files.sent")}
      className={styles.files}
    >
      {files.map((f) => (
        <Attachment key={f.id} file={{ name: f.name, size: f.size }}>
          <AttachmentPreview />
          <AttachmentBody>
            {opens.has(f.kind) && (
              <AttachmentLink
                href={assistantFileUrl(f.id)}
                target="_blank"
                rel="noreferrer"
              />
            )}
            {!opens.has(f.kind) && <AttachmentFilename />}
            <AttachmentDetail />
          </AttachmentBody>
        </Attachment>
      ))}
    </AttachmentGroup>
  );
}
