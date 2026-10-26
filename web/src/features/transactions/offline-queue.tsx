import { Button } from "@slotted/react/button";
import { InlineMessage } from "@slotted/react/inline-message";
import { List, ListEmpty, ListSection } from "@slotted/react/list";
import {
  ListItem,
  ListItemActions,
  ListItemBody,
  ListItemContent,
  ListItemDescription,
  ListItemLabel,
} from "@slotted/react/list-item";
import { Stack } from "@slotted/react/stack";
import { Text } from "@slotted/react/typography";
import { useState } from "react";

import type { DeviceUser } from "@/features/session";
import { CaptureComposer } from "@/features/transactions/capture-composer";
import {
  QueueWriteError,
  enqueueCapture,
  readQueue,
  removeQueued,
} from "@/features/transactions/capture-queue";
import { readDefaultAccount } from "@/features/transactions/capture-store";
import { formatDate } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";

// The queue of the offline screen: a text queued for the device's last user with the day it was
// written (P4), the waiting texts and their discard (P7).
export function OfflineQueue({ user }: { user: DeviceUser }) {
  const t = useT();
  const [locale] = useAppLocale();
  const today = useToday();
  const [text, setText] = useState("");
  const [entries, setEntries] = useState(() => readQueue(user.id));
  const [failed, setFailed] = useState(false);

  const queue = () => {
    if (text.trim() === "") return;
    try {
      enqueueCapture({
        userId: user.id,
        text,
        defaultAccountId: readDefaultAccount(),
        capturedOn: today,
      });
    } catch (error) {
      if (error instanceof QueueWriteError) {
        setFailed(true);
        return;
      }
      throw error;
    }
    setFailed(false);
    setText("");
    setEntries(readQueue(user.id));
  };

  return (
    <Stack gap={4}>
      <Text size="sm" tone="muted">
        {t("offline.user", { email: user.email })}
      </Text>
      <CaptureComposer
        value={text}
        busy={false}
        autoFocus={false}
        onChange={(value) => {
          setText(value);
          setFailed(false);
        }}
        onRecord={queue}
      />
      {failed && (
        <InlineMessage tone="danger" size="md" live="polite">
          {t("offline.writeFailed")}
        </InlineMessage>
      )}
      <Button disabled={text.trim() === ""} onClick={queue}>
        {t("offline.queue")}
      </Button>
      <List variant="separated" aria-label={t("offline.queued")}>
        <ListSection label={t("offline.queued")}>
          {entries.length === 0 ? (
            <ListEmpty>{t("offline.empty")}</ListEmpty>
          ) : (
            entries.map((entry) => (
              <ListItem key={entry.id}>
                <ListItemContent>
                  <ListItemBody>
                    <ListItemLabel>{entry.text}</ListItemLabel>
                    <ListItemDescription>
                      {t("queue.writtenOn", {
                        date: formatDate(entry.capturedOn, locale),
                      })}
                    </ListItemDescription>
                  </ListItemBody>
                </ListItemContent>
                <ListItemActions>
                  <Button
                    size="sm"
                    variant="ghost"
                    tone="secondary"
                    onClick={() => {
                      removeQueued(entry.id);
                      setEntries(readQueue(user.id));
                    }}
                  >
                    {t("queue.discard")}
                  </Button>
                </ListItemActions>
              </ListItem>
            ))
          )}
        </ListSection>
      </List>
    </Stack>
  );
}
