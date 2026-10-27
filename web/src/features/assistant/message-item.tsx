import { Link } from "@tanstack/react-router";
import {
  Bubble,
  BubbleContent,
  Message,
  MessageActions,
  MessageBody,
  MessageFooter,
} from "@slotted/react/message";
import { Glyph, Icon } from "@slotted/react/icon";
import { Alert, AlertContent, AlertDescription } from "@slotted/react/alert";
import { Button, IconButton } from "@slotted/react/button";
import { Markdown } from "@slotted/react/markdown";
import type { MarkdownRenderers } from "@slotted/react/markdown";
import { Stack } from "@slotted/react/stack";
import { Text } from "@slotted/react/typography";
import { useMemo, useState } from "react";

import styles from "@/features/assistant/assistant-panel.module.css";
import type { AssistantMessage } from "@/features/assistant/sse";
import { parseAnswer } from "@/features/assistant/answer-markdown";
import {
  maskAmountText,
  maskAmounts,
  maskMatch,
} from "@/features/assistant/mask-amounts";
import { ConfirmAll } from "@/features/assistant/confirm-all";
import type { Decision } from "@/features/assistant/confirm-all";
import { ProposalCard } from "@/features/assistant/proposal-card";
import { TurnActivity } from "@/features/assistant/turn-activity";
import { useT } from "@/i18n/i18n-provider";
import { matchScreen } from "@/navigation/navigation-map";
import { usePrivacy } from "@/privacy/privacy-provider";

// A link to a screen of the navigation map becomes a router link; any other link is its label.
const renderers: MarkdownRenderers = {
  link: ({ element, children }) =>
    matchScreen(element.href) === undefined ? (
      children
    ) : (
      <Link to={element.href}>{children}</Link>
    ),
};

export function MessageItem({
  message,
  onRetry,
  steps,
  reveal = false,
  streaming = false,
}: {
  message: AssistantMessage;
  onRetry?: (() => void) | undefined;
  // The steps of the turn that produced this answer, when this session saw it.
  steps?: string[] | undefined;
  // The answer just arrived; its last card brings its actions into view (P13).
  reveal?: boolean;
  // The answer is still arriving; it has nothing to copy yet.
  streaming?: boolean;
}) {
  const t = useT();
  const { hidden } = usePrivacy();
  const own = message.role === "user";
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  const [copied, setCopied] = useState(false);
  const unanswered =
    message.outcome === "failed" || message.outcome === "canceled";
  const tree = useMemo(() => {
    if (own || message.content === "") return null;
    const parsed = parseAnswer(message.content);
    return hidden ? maskAmounts(parsed, maskMatch) : parsed;
  }, [own, message.content, hidden]);

  if (unanswered) {
    return (
      <Message align="start">
        <MessageBody>
          <Stack gap={2} align="start">
            <Text size="sm" tone="muted">
              {t(
                message.outcome === "failed"
                  ? "assistant.no_answer"
                  : "assistant.canceled",
              )}
            </Text>
            {onRetry !== undefined && (
              <Button variant="outline" size="sm" onClick={onRetry}>
                {t("assistant.retry")}
              </Button>
            )}
          </Stack>
        </MessageBody>
      </Message>
    );
  }

  return (
    <Message align={own ? "end" : "start"}>
      <MessageBody>
        {steps !== undefined && <TurnActivity steps={steps} running={false} />}
        {own ? (
          <Bubble>
            <BubbleContent>{message.content}</BubbleContent>
          </Bubble>
        ) : (
          // P10: an answer spans the thread without a bubble.
          <div className={styles.answer}>
            {tree === null ? (
              <Text size="md" tone="muted">
                {t("assistant.empty_answer")}
              </Text>
            ) : (
              <Markdown tree={tree} size="md" renderers={renderers} />
            )}
          </div>
        )}
        {(message.outcome === "step_limit" || message.proposals.length > 0) && (
          <Stack gap={3} className={styles.attached}>
            {message.outcome === "step_limit" && (
              <Alert tone="warning" reach="inline">
                <AlertContent>
                  <AlertDescription>
                    {t("assistant.step_limit")}
                  </AlertDescription>
                </AlertContent>
              </Alert>
            )}
            {message.proposals.map((proposal, i) => (
              <ProposalCard
                key={proposal.id}
                proposal={proposal}
                reveal={reveal && i === message.proposals.length - 1}
                decision={decisions[proposal.id]}
              />
            ))}
            <ConfirmAll
              proposals={message.proposals.filter(
                (p) => p.status === "pending",
              )}
              onDecided={(id, decision) => {
                setDecisions((d) => ({ ...d, [id]: decision }));
              }}
            />
          </Stack>
        )}
        {!own && tree !== null && !streaming && (
          <MessageFooter>
            <MessageActions>
              <IconButton
                aria-label={t(copied ? "assistant.copied" : "assistant.copy")}
                variant="ghost"
                size="sm"
                onClick={() => {
                  // P21: the answer's Markdown, masked like the screen while privacy is on.
                  const text = hidden
                    ? maskAmountText(message.content)
                    : message.content;
                  void navigator.clipboard.writeText(text).then(() => {
                    setCopied(true);
                    setTimeout(() => {
                      setCopied(false);
                    }, 2000);
                  });
                }}
              >
                <Icon>
                  <Glyph name={copied ? "check" : "copy"} />
                </Icon>
              </IconButton>
            </MessageActions>
          </MessageFooter>
        )}
      </MessageBody>
    </Message>
  );
}
