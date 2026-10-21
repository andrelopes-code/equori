import {
  Attachment,
  AttachmentActions,
  AttachmentBody,
  AttachmentDetail,
  AttachmentGroup,
  AttachmentLink,
  AttachmentPreview,
  AttachmentRemove,
} from "@slotted/react/attachment";
import { Button } from "@slotted/react/button";
import { Glyph, Icon } from "@slotted/react/icon";
import { InlineMessage } from "@slotted/react/inline-message";
import { Stack } from "@slotted/react/stack";
import { Text } from "@slotted/react/typography";
import { useQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";

import { useApi } from "@/api/api-context";
import { errorText } from "@/api/problem";
import {
  attachmentsQuery,
  useRemoveAttachment,
  useUploadAttachment,
} from "@/features/transactions/api";
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

  const items = files.data ?? [];
  return (
    <Stack gap={3}>
      {files.isError && (
        <InlineMessage tone="danger">{errorText(files.error, t)}</InlineMessage>
      )}
      {files.isSuccess && items.length === 0 && (
        <Text tone="muted">{t("attachments.none")}</Text>
      )}
      {items.length > 0 && (
        <AttachmentGroup aria-label={t("attachments.label")} size="sm">
          {items.map((item) => (
            <Attachment
              key={item.id}
              file={{
                name: item.file_name,
                type: item.media_type,
                size: item.size,
              }}
              loading={remove.isPending && remove.variables === item.id}
              {...(readOnly
                ? {}
                : {
                    onRemove: () => {
                      setError(null);
                      remove.mutateAsync(item.id).catch((caught: unknown) => {
                        setError(errorText(caught, t));
                      });
                    },
                  })}
            >
              <AttachmentPreview />
              <AttachmentBody>
                <AttachmentLink
                  href={`/api/v1/attachments/${item.id}/content`}
                  download={item.file_name}
                />
                <AttachmentDetail />
              </AttachmentBody>
              {!readOnly && (
                <AttachmentActions>
                  <AttachmentRemove />
                </AttachmentActions>
              )}
            </Attachment>
          ))}
        </AttachmentGroup>
      )}
      {error !== null && <InlineMessage tone="danger">{error}</InlineMessage>}
      {!readOnly && (
        <div>
          <input
            ref={input}
            className={styles.file}
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
