import { useQuery } from "@tanstack/react-query";
import { Button } from "@slotted/react/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@slotted/react/dialog";
import { InlineMessage } from "@slotted/react/inline-message";
import { Stack } from "@slotted/react/stack";
import { Text } from "@slotted/react/typography";
import { useState } from "react";

import { useApi } from "@/api/api-context";
import { errorText } from "@/api/problem";
import styles from "@/features/assistant/assistant-panel.module.css";
import {
  conversationsQuery,
  useDeleteConversation,
  useDeleteConversations,
} from "@/features/assistant/api";
import { useAppLocale, useT } from "@/i18n/i18n-provider";

export function ConversationList({ onOpen }: { onOpen: (id: string) => void }) {
  const t = useT();
  const [locale] = useAppLocale();
  const list = useQuery(conversationsQuery(useApi()));
  const remove = useDeleteConversation();
  const removeAll = useDeleteConversations();
  const [asking, setAsking] = useState(false);
  const day = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });
  const items = [...(list.data ?? [])].sort((a, b) =>
    b.updated_at.localeCompare(a.updated_at),
  );
  const error = list.error ?? remove.error ?? removeAll.error;

  return (
    <Stack gap={3}>
      {error !== null && (
        <InlineMessage tone="danger">{errorText(error, t)}</InlineMessage>
      )}
      <ul role="list" className={styles.items}>
        {items.map((c) => (
          <li key={c.id}>
            <Stack gap={1}>
              <Button
                variant="ghost"
                tone="secondary"
                onClick={() => {
                  onOpen(c.id);
                }}
              >
                {c.title}
              </Button>
              <Text size="xs" tone="muted">
                {day.format(new Date(c.updated_at))}
              </Text>
              <Button
                variant="ghost"
                tone="danger"
                size="sm"
                aria-label={`${t("assistant.delete_conversation")}: ${c.title}`}
                onClick={() => {
                  remove.mutate(c.id);
                }}
              >
                {t("assistant.delete_conversation")}
              </Button>
            </Stack>
          </li>
        ))}
      </ul>
      {items.length > 0 && (
        <Button
          variant="outline"
          tone="danger"
          onClick={() => {
            setAsking(true);
          }}
        >
          {t("assistant.delete_all")}
        </Button>
      )}
      <Dialog open={asking} size="sm" onOpenChange={setAsking}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("assistant.delete_all")}</DialogTitle>
            <DialogDescription>
              {t("assistant.delete_all_confirm")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              tone="secondary"
              onClick={() => {
                setAsking(false);
              }}
            >
              {t("detail.cancel")}
            </Button>
            <Button
              tone="danger"
              loading={removeAll.isPending}
              onClick={() => {
                removeAll.mutate(undefined, {
                  onSuccess: () => {
                    setAsking(false);
                  },
                });
              }}
            >
              {t("assistant.delete_all")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Stack>
  );
}
