import {
  Alert,
  AlertContent,
  AlertDescription,
  AlertTitle,
} from "@slotted/react/alert";

import type { components } from "@/api/schema.gen";
import { useT } from "@/i18n/i18n-provider";

type Chat = components["schemas"]["AssistantChat"];

// Shown before the first message of a conversation: where the content goes, what that host does
// with it.
export function ProviderNotice({ chat }: { chat: Chat }) {
  const t = useT();
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
