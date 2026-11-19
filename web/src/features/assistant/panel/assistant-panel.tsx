import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouterState } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";

import { useApi } from "@/api/api-context";
import { ProblemError } from "@/api/problem";
import type { AssistantFile } from "@/features/assistant/api";
import {
  assistantKeys,
  chatStateQuery,
  conversationQuery,
} from "@/features/assistant/api";
import { useAssistantAsk } from "@/features/assistant/model/ask-assistant";
import { AssistantAside } from "@/features/assistant/panel/assistant-aside";
import { AssistantComposer } from "@/features/assistant/panel/assistant-composer";
import { AssistantDrawer } from "@/features/assistant/panel/assistant-drawer";
import styles from "@/features/assistant/panel/assistant-panel.module.css";
import { BlockedNotice } from "@/features/assistant/panel/blocked-notice";
import { ChatWelcome } from "@/features/assistant/panel/chat-welcome";
import { ConversationFeed } from "@/features/assistant/conversation/conversation-feed";
import { ConversationList } from "@/features/assistant/conversation/conversation-list";
import { HeaderActions } from "@/features/assistant/panel/header-actions";
import { PendingDock } from "@/features/assistant/panel/pending-dock";
import { ProviderNotice } from "@/features/assistant/panel/provider-notice";
import { retryText } from "@/features/assistant/panel/retry-text";
import { routeSuggestions } from "@/features/assistant/panel/route-suggestions";
import { TurnErrorNotice } from "@/features/assistant/panel/turn-error-notice";
import { useAssistantTurn } from "@/features/assistant/conversation/use-assistant-turn";
import { usePanelFocus } from "@/features/assistant/panel/use-panel-focus";
import { usePanelTitle } from "@/features/assistant/panel/use-panel-title";
import { useRetryAt } from "@/features/assistant/panel/use-retry-at";
import { useAssistantFiles } from "@/features/assistant/panel/use-composer-files";
import { AskContext } from "@/features/assistant/view/ask-context";
import { compactQuery, useMediaQuery } from "@/ui/runtime/use-media-query";

interface AssistantPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // The shell's pane holds the panel; the caller renders it inside an AppShell (P9).
  beside?: boolean;
  // The element focused before the panel opened; focus returns to it on close (P18).
  returnFocus?: RefObject<HTMLElement | null>;
}

// The assistant's chat, as the shell's pane beside the page or as a drawer. Its state outlives
// closing it and a change of placement.
export function AssistantPanel({
  open,
  onOpenChange,
  returnFocus,
  beside = false,
}: AssistantPanelProps) {
  const api = useApi();
  const queryClient = useQueryClient();
  const phone = useMediaQuery(compactQuery);
  const page = useRouterState({ select: (s) => s.location.pathname });
  const turn = useAssistantTurn(page);

  const chat = useQuery({ ...chatStateQuery(api), enabled: open });
  const stored = useQuery({
    ...conversationQuery(api, turn.conversationId ?? ""),
    enabled: open && turn.conversationId !== undefined && turn.pending === null,
  });

  const [listing, setListing] = useState(false);
  // The composer's text lives here so that a move between the drawer and the pane keeps it.
  const [draftText, setDraftText] = useState("");
  // The files of the next message, kept across a move between the drawer and the pane.
  const files = useAssistantFiles();
  const composerRef = useRef<HTMLTextAreaElement>(null);
  useAssistantAsk(setDraftText);
  // The element that holds the feed; the dock watches its sheets.
  const [thread, setThread] = useState<HTMLElement | null>(null);

  // A kept conversation that was deleted, or belongs to another user, opens a new one (P19).
  const gone =
    stored.error instanceof ProblemError && stored.error.status === 404;
  const { reset } = turn;

  useEffect(() => {
    if (gone) reset();
  }, [gone, reset]);

  useRetryAt(chat.data?.retry_at, chat.dataUpdatedAt, () => {
    void queryClient.invalidateQueries({ queryKey: assistantKeys.chat() });
  });

  const ready = chat.data !== undefined;
  const blocked = chat.data?.available === false;

  usePanelFocus({
    open,
    beside,
    phone,
    canType: open && !listing && ready && !blocked,
    composerRef,
    returnFocus,
  });

  const messages =
    turn.conversationId === undefined ? [] : (stored.data?.messages ?? []);
  const started = messages.length > 0 || turn.pending !== null;
  // A question the server stored without any answer (the answer failed to store) reads as failed.
  const orphan = messages.at(-1)?.role === "user" && turn.pending === null;
  const retry = retryText(messages, { blocked, orphan });
  const title = usePanelTitle(listing, stored.data, turn);

  function close() {
    onOpenChange(false);
  }

  function send(text: string, sent: AssistantFile[] = []) {
    if (turn.pending !== null) return;

    setListing(false);
    turn.send(text, sent);
  }

  function startNew() {
    turn.reset();
    setListing(false);
  }

  function openConversation(id: string) {
    turn.open(id);
    setListing(false);
  }

  const handleRetry =
    retry === undefined
      ? undefined
      : () => {
          send(retry);
        };

  // Each element below is passed to the pane and to the drawer.
  const notices = (
    <>
      {blocked && (
        <BlockedNotice retryAt={chat.data?.retry_at} onClose={close} />
      )}
      <TurnErrorNotice error={turn.error} />
    </>
  );

  const actions = (
    <HeaderActions
      listing={listing}
      onBack={() => {
        setListing(false);
      }}
      onHistory={() => {
        setListing(true);
      }}
      onNew={startNew}
      onClose={close}
    />
  );

  const body = (
    <div data-own="assistant-panel" className={styles.thread} ref={setThread}>
      {listing && (
        <div className={styles.scroll}>
          <ConversationList
            current={turn.conversationId}
            onOpen={openConversation}
          />
        </div>
      )}

      {!listing && !started && (
        <div className={styles.scroll}>
          <ChatWelcome
            canAsk={ready && !blocked}
            suggestions={routeSuggestions(page)}
            onAsk={send}
            notices={
              <>
                {notices}
                {chat.data !== undefined && <ProviderNotice chat={chat.data} />}
              </>
            }
          />
        </div>
      )}

      {!listing && started && (
        <AskContext value={ready && !blocked ? send : undefined}>
          <ConversationFeed
            messages={messages}
            turn={turn}
            orphan={orphan}
            onRetry={handleRetry}
          />
        </AskContext>
      )}
    </div>
  );

  const footer = listing ? null : (
    <div className={styles.footerStack}>
      {started && <PendingDock scrollRoot={thread} />}

      <div className={styles.composer}>
        {started && notices}
        <AssistantComposer
          disabled={blocked || !ready}
          busy={turn.pending !== null}
          chat={chat.data}
          files={files}
          onSend={send}
          onStop={turn.stop}
          inputRef={composerRef}
          value={draftText}
          onValueChange={setDraftText}
        />
      </div>
    </div>
  );

  if (beside) {
    // A closed pane leaves the layout; its state stays here.
    if (!open) return null;

    return (
      <AssistantAside
        title={title}
        actions={actions}
        body={body}
        footer={footer}
        onClose={close}
      />
    );
  }

  return (
    <AssistantDrawer
      open={open}
      onOpenChange={onOpenChange}
      phone={phone}
      listing={listing}
      composerRef={composerRef}
      returnFocus={returnFocus}
      title={title}
      actions={actions}
      body={body}
      footer={footer}
    />
  );
}
