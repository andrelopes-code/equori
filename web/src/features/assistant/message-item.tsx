import { Link } from "@tanstack/react-router";
import {
  Bubble,
  BubbleContent,
  Message,
  MessageBody,
} from "@slotted/react/message";
import { Alert, AlertContent, AlertDescription } from "@slotted/react/alert";
import { Markdown } from "@slotted/react/markdown";
import type { MarkdownRenderers } from "@slotted/react/markdown";
import { Stack } from "@slotted/react/stack";
import { useMemo } from "react";

import styles from "@/features/assistant/assistant-panel.module.css";
import type { AssistantMessage } from "@/features/assistant/sse";
import { parseAnswer } from "@/features/assistant/answer-markdown";
import { maskAmounts, maskMatch } from "@/features/assistant/mask-amounts";
import { ProposalCard } from "@/features/assistant/proposal-card";
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

export function MessageItem({ message }: { message: AssistantMessage }) {
  const t = useT();
  const { hidden } = usePrivacy();
  const own = message.role === "user";
  const tree = useMemo(() => {
    if (own || message.content === "") return null;
    const parsed = parseAnswer(message.content);
    return hidden ? maskAmounts(parsed, maskMatch) : parsed;
  }, [own, message.content, hidden]);

  return (
    <Message align={own ? "end" : "start"}>
      <MessageBody>
        <Bubble className={own ? undefined : styles.answer}>
          <BubbleContent className={own ? undefined : styles.answerContent}>
            {own ? (
              message.content
            ) : tree === null ? (
              t("assistant.empty_answer")
            ) : (
              <Markdown tree={tree} size="md" renderers={renderers} />
            )}
          </BubbleContent>
        </Bubble>
        {(message.outcome === "step_limit" ||
          message.outcome === "failed" ||
          message.proposals.length > 0) && (
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
            {message.outcome === "failed" && (
              <Alert tone="danger" reach="inline">
                <AlertContent>
                  <AlertDescription>{t("assistant.failed")}</AlertDescription>
                </AlertContent>
              </Alert>
            )}
            {message.proposals.map((proposal) => (
              <ProposalCard key={proposal.id} proposal={proposal} />
            ))}
          </Stack>
        )}
      </MessageBody>
    </Message>
  );
}
