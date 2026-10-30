import {
  Attachment,
  AttachmentActions,
  AttachmentBody,
  AttachmentDetail,
  AttachmentLink,
  AttachmentPreview,
  AttachmentRemove,
  AttachmentTrigger,
} from "@slotted/react/attachment";

import type { components } from "@/api/schema.gen";
import {
  contentURL,
  formatFileSize,
  formatUploaded,
} from "@/features/transactions/attachment-meta";
import styles from "@/features/transactions/attachments-section.module.css";
import { useAppLocale, useT } from "@/i18n/i18n-provider";

type File = components["schemas"]["Attachment"];

export interface AttachmentCardProps {
  item: File;
  // Undefined when the viewer does not show the file: the card downloads it instead.
  onView: (() => void) | undefined;
  // Undefined when the transaction is read-only.
  onRemove: (() => void) | undefined;
  removing: boolean;
}

export function AttachmentCard({
  item,
  onView,
  onRemove,
  removing,
}: AttachmentCardProps) {
  const t = useT();
  const [tag] = useAppLocale();

  const image = item.media_type.startsWith("image/");

  return (
    <Attachment
      file={{ name: item.file_name, type: item.media_type, size: item.size }}
      loading={removing}
      {...(onRemove === undefined ? {} : { onRemove })}
    >
      {image ? (
        <AttachmentPreview src={contentURL(item.id)} />
      ) : (
        <AttachmentPreview />
      )}

      <AttachmentBody>
        {onView === undefined ? (
          <AttachmentLink
            href={contentURL(item.id)}
            download={item.file_name}
          />
        ) : (
          <AttachmentTrigger onClick={onView} />
        )}
        <AttachmentDetail className={styles.detail}>
          {t("attachment.detail", {
            size: formatFileSize(item.size, tag),
            uploaded: formatUploaded(item.created_at, tag),
          })}
        </AttachmentDetail>
      </AttachmentBody>

      {onRemove !== undefined && (
        <AttachmentActions>
          <AttachmentRemove />
        </AttachmentActions>
      )}
    </Attachment>
  );
}
