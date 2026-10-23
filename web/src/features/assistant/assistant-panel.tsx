import { useQuery } from "@tanstack/react-query";
import { useRouterState } from "@tanstack/react-router";
import { Button } from "@slotted/react/button";
import {
  Drawer,
  DrawerBody,
  DrawerClose,
  DrawerHeader,
  DrawerPanel,
  DrawerTitle,
} from "@slotted/react/drawer";
import { InlineMessage } from "@slotted/react/inline-message";
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
import {
  PromptComposer,
  PromptComposerFooter,
  PromptComposerInput,
  PromptComposerSubmit,
} from "@slotted/react/prompt-composer";
import { Inline } from "@slotted/react/inline";
import { useState, useSyncExternalStore } from "react";

import { useApi } from "@/api/api-context";
import { problemMessage } from "@/api/problem";
import styles from "@/features/assistant/assistant-panel.module.css";
import { chatStateQuery, conversationQuery } from "@/features/assistant/api";
import { ConversationList } from "@/features/assistant/conversation-list";
import { MessageItem } from "@/features/assistant/message-item";
import { catalogKey } from "@/features/assistant/proposal-card";
import { ProviderNotice } from "@/features/assistant/provider-notice";
import type { AssistantProblem } from "@/features/assistant/sse";
import { useAssistantTurn } from "@/features/assistant/use-assistant-turn";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import type { TFunction } from "@/i18n/i18n-provider";

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

// A side panel beside the page from 600 px; full screen on a phone. Its state outlives closing it.
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
  const stepKey =
    turn.step === null ? undefined : catalogKey(`assistant.step.${turn.step}`);

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      side="end"
      size={phone ? "full" : "md"}
      modal={phone}
      outsidePress="none"
    >
      <DrawerPanel>
        <DrawerHeader>
          <DrawerTitle>{t("assistant.title")}</DrawerTitle>
          <DrawerClose />
        </DrawerHeader>
        <DrawerBody>
          <div data-own="assistant-panel" className={styles.thread}>
            {listing ? (
              <div className={styles.scroll}>
                <ConversationList
                  onOpen={(id) => {
                    turn.open(id);
                    setListing(false);
                  }}
                />
              </div>
            ) : (
              <MessageScroller
                follow
                defaultPosition="end"
                busy={turn.pending !== null}
              >
                <MessageScrollerViewport>
                  <MessageScrollerContent className={styles.feed}>
                    {!started && chat.data !== undefined && (
                      <ProviderNotice chat={chat.data} />
                    )}
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
                    {blockedText !== null && (
                      <InlineMessage
                        tone={exhausted ? "warning" : "danger"}
                        live="polite"
                      >
                        {blockedText}
                      </InlineMessage>
                    )}
                  </MessageScrollerContent>
                </MessageScrollerViewport>
              </MessageScroller>
            )}
            <div className={styles.composer}>
              <Inline gap={2}>
                <Button
                  variant="ghost"
                  tone="secondary"
                  size="sm"
                  onClick={() => {
                    turn.reset();
                    setListing(false);
                  }}
                >
                  {t("assistant.new_conversation")}
                </Button>
                <Button
                  variant="ghost"
                  tone="secondary"
                  size="sm"
                  onClick={() => {
                    setListing((l) => !l);
                  }}
                >
                  {t("assistant.conversations")}
                </Button>
              </Inline>
              <PromptComposer
                disabled={blocked || chat.data === undefined}
                status={turn.pending === null ? "ready" : "submitted"}
                messages={{ send: t("assistant.composer.send") }}
                onValueSubmit={(value) => {
                  if (turn.pending === null && value.trim() !== "")
                    turn.send(value.trim());
                }}
              >
                <PromptComposerInput
                  aria-label={t("assistant.composer.placeholder")}
                  placeholder={t("assistant.composer.placeholder")}
                  maxLength={4000}
                />
                <PromptComposerFooter>
                  <PromptComposerSubmit />
                </PromptComposerFooter>
              </PromptComposer>
            </div>
          </div>
        </DrawerBody>
      </DrawerPanel>
    </Drawer>
  );
}
