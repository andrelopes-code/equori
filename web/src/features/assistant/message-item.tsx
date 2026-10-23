import { Link } from "@tanstack/react-router";
import {
  Bubble,
  BubbleContent,
  Message,
  MessageBody,
} from "@slotted/react/message";
import { InlineMessage } from "@slotted/react/inline-message";
import { Markdown } from "@slotted/react/markdown";
import type { MarkdownRenderers } from "@slotted/react/markdown";
import { useMemo } from "react";

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
        <Bubble>
          <BubbleContent>
            {own ? (
              message.content
            ) : tree === null ? (
              t("assistant.empty_answer")
            ) : (
              <Markdown tree={tree} size="md" renderers={renderers} />
            )}
          </BubbleContent>
        </Bubble>
        {message.outcome === "step_limit" && (
          <InlineMessage tone="warning">
            {t("assistant.step_limit")}
          </InlineMessage>
        )}
        {message.outcome === "failed" && (
          <InlineMessage tone="danger">{t("assistant.failed")}</InlineMessage>
        )}
        {message.proposals.map((proposal) => (
          <ProposalCard key={proposal.id} proposal={proposal} />
        ))}
      </MessageBody>
    </Message>
  );
}
