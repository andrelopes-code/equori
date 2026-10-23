import { InlineMessage } from "@slotted/react/inline-message";
import { Stack } from "@slotted/react/stack";
import { Text } from "@slotted/react/typography";

import type { components } from "@/api/schema.gen";
import { useT } from "@/i18n/i18n-provider";

type Chat = components["schemas"]["AssistantChat"];

// Shown before the first message of a conversation: where the content goes and what that host does with it.
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
    <InlineMessage
      tone={chat.notice === "trains" ? "warning" : "info"}
      size="md"
    >
      <Stack gap={1}>
        <Text>
          {t("assistant.notice.provider", {
            provider: chat.provider_name,
            model: chat.model,
          })}
        </Text>
        <Text>{sentence}</Text>
      </Stack>
    </InlineMessage>
  );
}
