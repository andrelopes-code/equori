import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import {
  Alert,
  AlertActions,
  AlertContent,
  AlertDescription,
  AlertTitle,
} from "@slotted/react/alert";
import { Button } from "@slotted/react/button";
import {
  Drawer,
  DrawerBody,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerPanel,
  DrawerResizer,
  DrawerTitle,
} from "@slotted/react/drawer";
import {
  Bubble,
  BubbleContent,
  BubbleTyping,
  Message,
  MessageActivity,
  MessageActivityStep,
  MessageBody,
} from "@slotted/react/message";
import {
  MessageScroller,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerViewport,
} from "@slotted/react/message-scroller";
import { Text } from "@slotted/react/typography";
import { useState, useSyncExternalStore } from "react";

import { useApi } from "@/api/api-context";
import { problemMessage } from "@/api/problem";
import styles from "@/features/assistant/assistant-panel.module.css";
import {
  assistantKeys,
  chatStateQuery,
  conversationQuery,
} from "@/features/assistant/api";
import { AssistantComposer } from "@/features/assistant/assistant-composer";
import { ChatWelcome } from "@/features/assistant/chat-welcome";
import { ConversationList } from "@/features/assistant/conversation-list";
import { maskAmountText } from "@/features/assistant/mask-amounts";
import { MessageItem } from "@/features/assistant/message-item";
import { catalogKey } from "@/features/assistant/proposal-card";
import { HeaderActions } from "@/features/assistant/header-actions";
import { ProviderNotice } from "@/features/assistant/provider-notice";
import { useAssistantTurn } from "@/features/assistant/use-assistant-turn";
import { useRetryAt } from "@/features/assistant/use-retry-at";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { usePrivacy } from "@/privacy/privacy-provider";

const PHONE_QUERY = "(max-width: 599px)";

function subscribe(onChange: () => void): () => void {
  const list = matchMedia(PHONE_QUERY);
  list.addEventListener("change", onChange);
  return () => {
    list.removeEventListener("change", onChange);
  };
}

function usePhone(): boolean {
  return useSyncExternalStore(subscribe, () => matchMedia(PHONE_QUERY).matches);
}

// The chat state answers these codes; the stored conversation shows a failed turn (P6, P7).
const stateCodes = new Set([
  "assistant_exhausted",
  "assistant_unavailable",
  "assistant_failed",
]);

// A side panel beside the page from 600 px; a full-height bottom sheet on a phone, whose composer
// is the sheet's footer and stays at the screen's foot while the sheet is dragged. Its state
// outlives closing it.
export function AssistantPanel({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useT();
  const api = useApi();
  const [locale] = useAppLocale();
  const phone = usePhone();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const page = useRouterState({ select: (s) => s.location.pathname });
  const turn = useAssistantTurn(page);
  const [listing, setListing] = useState(false);
  const { hidden } = usePrivacy();
  const chat = useQuery({ ...chatStateQuery(api), enabled: open });
  const stored = useQuery({
    ...conversationQuery(api, turn.conversationId ?? ""),
    enabled: open && turn.conversationId !== undefined && turn.pending === null,
  });

  const time = (iso: string) =>
    new Intl.DateTimeFormat(locale, {
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(iso));
  const messages =
    turn.conversationId === undefined ? [] : (stored.data?.messages ?? []);
  useRetryAt(chat.data?.retry_at, () => {
    void queryClient.invalidateQueries({ queryKey: assistantKeys.chat() });
  });
  const blocked = chat.data?.available === false;
  const started = messages.length > 0 || turn.pending !== null;
  const retryAt = chat.data?.retry_at;
  const blockedNotice =
    chat.data?.available !== false ? null : retryAt !== undefined ? (
      <Alert tone="warning" live="polite">
        <AlertContent>
          <AlertTitle>{t("assistant.exhausted.title")}</AlertTitle>
          <AlertDescription>
            {t("assistant.exhausted", { time: time(retryAt) })}
          </AlertDescription>
        </AlertContent>
      </Alert>
    ) : (
      <Alert tone="info" live="polite">
        <AlertContent>
          <AlertTitle>{t("assistant.unavailable.title")}</AlertTitle>
          <AlertDescription>{t("assistant.unavailable.body")}</AlertDescription>
        </AlertContent>
        <AlertActions>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              onOpenChange(false);
              void navigate({
                to: "/settings",
                search: { section: "assistant" },
              });
            }}
          >
            {t("assistant.setup")}
          </Button>
        </AlertActions>
      </Alert>
    );
  const errorNotice = turn.error !== null &&
    !stateCodes.has(turn.error.code) && (
      <Alert tone="danger" live="polite">
        <AlertContent>
          <AlertTitle>{t("assistant.failed.title")}</AlertTitle>
          <AlertDescription>{problemMessage(turn.error, t)}</AlertDescription>
        </AlertContent>
      </Alert>
    );
  const send = (text: string) => {
    if (turn.pending !== null) return;
    setListing(false);
    turn.send(text);
  };
  const last = messages.at(-1);
  const retryText =
    last?.outcome === "failed" || last?.outcome === "canceled"
      ? messages.at(-2)?.content
      : undefined;
  // While the first turn runs, the conversation is named after the question (U13).
  const storedTitle =
    stored.data === undefined && turn.pending !== null
      ? turn.pending
      : stored.data?.title;
  const title = listing
    ? t("assistant.conversations")
    : storedTitle === undefined ||
        (turn.conversationId === undefined && turn.pending === null)
      ? t("assistant.new_conversation")
      : hidden
        ? maskAmountText(storedTitle)
        : storedTitle;
  const stepKey =
    turn.step === null ? undefined : catalogKey(`assistant.step.${turn.step}`);

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      side={phone ? "bottom" : "end"}
      size={phone ? "full" : "xl"}
      modal={phone}
      outsidePress="none"
    >
      <DrawerPanel className={styles.panel}>
        {phone && <DrawerResizer />}
        <DrawerHeader>
          <DrawerTitle>{t("assistant.title")}</DrawerTitle>
          <DrawerDescription>
            <Text truncate>{title}</Text>
          </DrawerDescription>
          <HeaderActions
            listing={listing}
            onBack={() => {
              setListing(false);
            }}
            onHistory={() => {
              setListing(true);
            }}
            onNew={() => {
              turn.reset();
              setListing(false);
            }}
            onClose={() => {
              onOpenChange(false);
            }}
          />
        </DrawerHeader>
        <DrawerBody>
          <div data-own="assistant-panel" className={styles.thread}>
            {listing ? (
              <div className={styles.scroll}>
                <ConversationList
                  current={turn.conversationId}
                  onOpen={(id) => {
                    turn.open(id);
                    setListing(false);
                  }}
                />
              </div>
            ) : !started ? (
              // Workaround for Slotted finding "A message scroller without items keeps its content hidden": before the first message the notices sit outside the scroller.
              <div className={styles.scroll}>
                <ChatWelcome
                  canAsk={!blocked && chat.data !== undefined}
                  onAsk={send}
                  notices={
                    <>
                      {blockedNotice}
                      {errorNotice}
                      {chat.data !== undefined && (
                        <ProviderNotice chat={chat.data} />
                      )}
                    </>
                  }
                />
              </div>
            ) : (
              <MessageScroller
                follow
                defaultPosition="end"
                busy={turn.pending !== null}
              >
                <MessageScrollerViewport className={styles.viewport}>
                  <MessageScrollerContent className={styles.feed}>
                    {messages.map((m) => (
                      <MessageScrollerItem
                        key={m.id}
                        messageId={m.id}
                        anchor={m.role === "user"}
                      >
                        <MessageItem
                          message={m}
                          onRetry={
                            m === last && retryText !== undefined
                              ? () => {
                                  send(retryText);
                                }
                              : undefined
                          }
                        />
                      </MessageScrollerItem>
                    ))}
                    {turn.pending !== null && (
                      <>
                        <MessageScrollerItem messageId="pending" anchor>
                          <Message align="end">
                            <MessageBody>
                              <Bubble>
                                <BubbleContent>{turn.pending}</BubbleContent>
                              </Bubble>
                            </MessageBody>
                          </Message>
                        </MessageScrollerItem>
                        <Message status="streaming">
                          <MessageBody>
                            {stepKey === undefined ? (
                              <Bubble>
                                <BubbleTyping />
                              </Bubble>
                            ) : (
                              <MessageActivity>
                                <MessageActivityStep>
                                  {t(stepKey)}
                                </MessageActivityStep>
                              </MessageActivity>
                            )}
                          </MessageBody>
                        </Message>
                      </>
                    )}
                  </MessageScrollerContent>
                </MessageScrollerViewport>
              </MessageScroller>
            )}
          </div>
        </DrawerBody>
        {!listing && (
          <DrawerFooter>
            <div className={styles.composer}>
              {started && blockedNotice}
              {started && errorNotice}
              <AssistantComposer
                disabled={blocked || chat.data === undefined}
                busy={turn.pending !== null}
                onSend={send}
              />
            </div>
          </DrawerFooter>
        )}
      </DrawerPanel>
    </Drawer>
  );
}
