import { useQuery } from "@tanstack/react-query";
import { useRouterState } from "@tanstack/react-router";
import {
  Alert,
  AlertContent,
  AlertDescription,
  AlertTitle,
} from "@slotted/react/alert";
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
import { chatStateQuery, conversationQuery } from "@/features/assistant/api";
import { AssistantComposer } from "@/features/assistant/assistant-composer";
import { ChatWelcome } from "@/features/assistant/chat-welcome";
import { ConversationList } from "@/features/assistant/conversation-list";
import { maskAmountText } from "@/features/assistant/mask-amounts";
import { MessageItem } from "@/features/assistant/message-item";
import { catalogKey } from "@/features/assistant/proposal-card";
import { HeaderActions } from "@/features/assistant/header-actions";
import { ProviderNotice } from "@/features/assistant/provider-notice";
import type { AssistantProblem } from "@/features/assistant/sse";
import { useAssistantTurn } from "@/features/assistant/use-assistant-turn";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import type { TFunction } from "@/i18n/i18n-provider";
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

function problemText(
  problem: AssistantProblem,
  t: TFunction,
  time: (iso: string) => string,
): string {
  switch (problem.code) {
    case "assistant_exhausted":
      return problem.retry_at === undefined
        ? t("assistant.failed")
        : t("assistant.exhausted", { time: time(problem.retry_at) });
    case "assistant_unavailable":
      return t("assistant.unavailable");
    case "assistant_failed":
      return t("assistant.failed");
    default:
      return problemMessage(problem, t);
  }
}

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
  const exhausted =
    turn.error?.code === "assistant_exhausted" ||
    (chat.data?.available === false && chat.data.retry_at !== undefined);
  const blocked =
    chat.data?.available === false ||
    turn.error?.code === "assistant_exhausted";
  const blockedText =
    turn.error !== null
      ? problemText(turn.error, t, time)
      : chat.data?.available === false
        ? chat.data.retry_at === undefined
          ? t("assistant.unavailable")
          : t("assistant.exhausted", { time: time(chat.data.retry_at) })
        : null;
  const started = messages.length > 0 || turn.pending !== null;
  const blockedTitle = exhausted
    ? t("assistant.exhausted.title")
    : turn.error === null
      ? t("assistant.unavailable.title")
      : t("assistant.failed.title");
  const blockedNotice = blockedText !== null && (
    <Alert tone={exhausted ? "warning" : "danger"} live="polite">
      <AlertContent>
        <AlertTitle>{blockedTitle}</AlertTitle>
        <AlertDescription>{blockedText}</AlertDescription>
      </AlertContent>
    </Alert>
  );
  const send = (text: string) => {
    setListing(false);
    turn.send(text);
  };
  const storedTitle = stored.data?.title;
  const title = listing
    ? t("assistant.conversations")
    : storedTitle === undefined || turn.conversationId === undefined
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
                        <MessageItem message={m} />
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
