import {
  Alert,
  AlertContent,
  AlertDescription,
  AlertTitle,
} from "@slotted/react/alert";

import type { components } from "@/api/schema.gen";
import { chatWithTarget } from "@/features/assistant/model/chat-target";
import { useChatTarget } from "@/features/assistant/model/use-chat-target";
import { useT } from "@/i18n/i18n-provider";

type Chat = components["schemas"]["AssistantChat"];

// Shown before the first message of a conversation: where the content goes, what that host does
// with it. A chosen target names its own provider and notice (MC7).
export function ProviderNotice({ chat: offered }: { chat: Chat }) {
  const t = useT();
  const chat = chatWithTarget(offered, useChatTarget(offered));

  if (chat.provider_name === undefined || chat.model === undefined) return null;
  const sentence =
    chat.notice === "trains"
      ? t("assistant.chat_notice.trains")
      : chat.notice === "local"
        ? t("assistant.chat_notice.local")
        : t("assistant.chat_notice.provider_terms");
  return (
    <Alert tone={chat.notice === "trains" ? "warning" : "info"}>
      <AlertContent>
        <AlertTitle>{t("assistant.notice.title")}</AlertTitle>
        <AlertDescription>
          {[
            t("assistant.notice.provider", {
              provider: chat.provider_name,
              model: chat.model,
            }),
            sentence,
          ].join(" ")}
        </AlertDescription>
      </AlertContent>
    </Alert>
  );
}
