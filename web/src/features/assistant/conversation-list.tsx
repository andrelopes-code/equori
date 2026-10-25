import { useQuery } from "@tanstack/react-query";
import { Alert, AlertContent, AlertDescription } from "@slotted/react/alert";
import { Button, IconButton } from "@slotted/react/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@slotted/react/dialog";
import { Glyph, Icon } from "@slotted/react/icon";
import { List, ListEmpty, ListSection } from "@slotted/react/list";
import {
  ListItem,
  ListItemActions,
  ListItemBody,
  ListItemButton,
  ListItemDescription,
  ListItemLabel,
} from "@slotted/react/list-item";
import { Stack } from "@slotted/react/stack";
import { useState } from "react";

import { useApi } from "@/api/api-context";
import { errorText } from "@/api/problem";
import styles from "@/features/assistant/assistant-panel.module.css";
import {
  conversationsQuery,
  useDeleteConversation,
  useDeleteConversations,
} from "@/features/assistant/api";
import { maskAmountText } from "@/features/assistant/mask-amounts";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { usePrivacy } from "@/privacy/privacy-provider";

type Group = "today" | "week" | "older";

const groupLabel = {
  today: "assistant.conversations.today",
  week: "assistant.conversations.week",
  older: "assistant.conversations.older",
} as const;

// The conversation's recency in the reader's own calendar: today, the six days before, or earlier.
function groupOf(updatedAt: string, now: Date): Group {
  const day = new Date(updatedAt);
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (day >= start) return "today";
  start.setDate(start.getDate() - 6);
  return day >= start ? "week" : "older";
}

// Families read: list, list-item, button, alert, dialog. The reader's conversations newest first,
// grouped by recency; a row opens its conversation and carries its own delete.
export function ConversationList({
  current,
  onOpen,
}: {
  current?: string | undefined;
  onOpen: (id: string) => void;
}) {
  const t = useT();
  const [locale] = useAppLocale();
  const { hidden } = usePrivacy();
  const list = useQuery(conversationsQuery(useApi()));
  const remove = useDeleteConversation();
  const removeAll = useDeleteConversations();
  const [asking, setAsking] = useState(false);
  const now = new Date();
  const time = new Intl.DateTimeFormat(locale, { timeStyle: "short" });
  const day = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });
  const items = [...(list.data ?? [])].sort((a, b) =>
    b.updated_at.localeCompare(a.updated_at),
  );
  const groups = (["today", "week", "older"] as const)
    .map((g) => ({
      g,
      rows: items.filter((c) => groupOf(c.updated_at, now) === g),
    }))
    .filter((x) => x.rows.length > 0);
  const error = list.error ?? remove.error ?? removeAll.error;

  return (
    <Stack gap={4}>
      {error !== null && (
        <Alert tone="danger" reach="inline" live="polite">
          <AlertContent>
            <AlertDescription>{errorText(error, t)}</AlertDescription>
          </AlertContent>
        </Alert>
      )}
      <List
        variant="separated"
        className={styles.conversations}
        aria-label={t("assistant.conversations")}
      >
        {list.isSuccess && items.length === 0 && (
          <ListEmpty>{t("assistant.conversations.empty")}</ListEmpty>
        )}
        {groups.map(({ g, rows }) => (
          <ListSection key={g} label={t(groupLabel[g])}>
            {rows.map((c) => {
              const title = hidden ? maskAmountText(c.title) : c.title;
              const at = new Date(c.updated_at);
              return (
                <ListItem key={c.id} current={c.id === current} truncate>
                  <ListItemButton
                    onClick={() => {
                      onOpen(c.id);
                    }}
                  >
                    <ListItemBody>
                      <ListItemLabel>{title}</ListItemLabel>
                      <ListItemDescription>
                        {g === "today" ? time.format(at) : day.format(at)}
                      </ListItemDescription>
                    </ListItemBody>
                  </ListItemButton>
                  <ListItemActions>
                    <IconButton
                      aria-label={`${t("assistant.delete_conversation")}: ${title}`}
                      size="sm"
                      tone="danger"
                      onClick={() => {
                        remove.mutate(c.id);
                      }}
                    >
                      <Icon>
                        <Glyph name="trash" />
                      </Icon>
                    </IconButton>
                  </ListItemActions>
                </ListItem>
              );
            })}
          </ListSection>
        ))}
      </List>
      {items.length > 0 && (
        <span className={styles.listFoot}>
          <Button
            variant="ghost"
            tone="danger"
            size="sm"
            onClick={() => {
              setAsking(true);
            }}
          >
            {t("assistant.delete_all")}
          </Button>
        </span>
      )}
      <Dialog
        open={asking}
        size="sm"
        fullScreen="never"
        onOpenChange={setAsking}
      >
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
