import { AttachmentGroup } from "@slotted/react/attachment";
import { Button } from "@slotted/react/button";
import { Glyph, Icon } from "@slotted/react/icon";
import { InlineMessage } from "@slotted/react/inline-message";
import { MediaViewer } from "@slotted/react/media-viewer";
import { Stack } from "@slotted/react/stack";
import { Text } from "@slotted/react/typography";
import { VisuallyHidden } from "@slotted/react/visually-hidden";
import { useQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";

import { useApi } from "@/api/api-context";
import { errorText } from "@/api/problem";
import {
  attachmentsQuery,
  useRemoveAttachment,
  useUploadAttachment,
} from "@/features/transactions/api";
import { AttachmentCard } from "@/features/transactions/attachment-card";
import { mediaItem } from "@/features/transactions/attachment-meta";
import styles from "@/features/transactions/attachments-section.module.css";
import { useT } from "@/i18n/i18n-provider";

// The media types the server detects and keeps (N26).
const accepted = "application/pdf,image/jpeg,image/png,image/webp,text/plain";

export function AttachmentsSection({
  transactionId,
  readOnly,
}: {
  transactionId: string;
  readOnly: boolean;
}) {
  const t = useT();
  const api = useApi();
  const files = useQuery(attachmentsQuery(api, transactionId));
  const upload = useUploadAttachment(transactionId);
  const remove = useRemoveAttachment(transactionId);
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [viewing, setViewing] = useState("");
  const [viewerOpen, setViewerOpen] = useState(false);

  const items = files.data ?? [];
  const isImage = (mediaType: string) => mediaType.startsWith("image/");
  const viewable = items.filter(
    (item) => isImage(item.media_type) || item.media_type === "application/pdf",
  );
  return (
    <Stack gap={3}>
      {files.isError && (
        <InlineMessage tone="danger">{errorText(files.error, t)}</InlineMessage>
      )}
      {files.isSuccess && items.length === 0 && (
        <Text tone="muted">{t("attachments.none")}</Text>
      )}
      {items.length > 0 && (
        <AttachmentGroup
          aria-label={t("attachments.label")}
          size="sm"
          layout="grid"
          className={styles.group}
          orientation="vertical"
        >
          {items.map((item) => (
            <AttachmentCard
              key={item.id}
              item={item}
              removing={remove.isPending && remove.variables === item.id}
              onView={
                viewable.includes(item)
                  ? () => {
                      setViewing(item.id);
                      setViewerOpen(true);
                    }
                  : undefined
              }
              onRemove={
                readOnly
                  ? undefined
                  : () => {
                      setError(null);
                      remove.mutateAsync(item.id).catch((caught: unknown) => {
                        setError(errorText(caught, t));
                      });
                    }
              }
            />
          ))}
        </AttachmentGroup>
      )}
      <MediaViewer
        items={viewable.map(mediaItem)}
        open={viewerOpen}
        onOpenChange={setViewerOpen}
        value={viewing}
        onValueChange={setViewing}
      />
      {error !== null && <InlineMessage tone="danger">{error}</InlineMessage>}
      {!readOnly && (
        <div>
          <VisuallyHidden>
            <input
              ref={input}
              type="file"
              accept={accepted}
              aria-label={t("attachments.add")}
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file === undefined) return;
                setError(null);
                upload.mutateAsync(file).catch((caught: unknown) => {
                  setError(errorText(caught, t));
                });
              }}
            />
          </VisuallyHidden>
          <Button
            size="sm"
            variant="outline"
            tone="secondary"
            loading={upload.isPending}
            start={
              <Icon size="sm">
                <Glyph name="paperclip" />
              </Icon>
            }
            onClick={() => input.current?.click()}
          >
            {t("attachments.add")}
          </Button>
        </div>
      )}
    </Stack>
  );
}
