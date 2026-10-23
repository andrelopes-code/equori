import { Tag } from "@slotted/react/tag";

import type { ModelProvider } from "@/features/setup/api";
import { useT } from "@/i18n/i18n-provider";

const tones = {
  trains: "warning",
  local: "success",
  provider_terms: "secondary",
} as const;

// What a provider does with submitted data (ADR 019); the full sentence is the tag's title.
export function NoticeTag({ notice }: { notice: ModelProvider["notice"] }) {
  const t = useT();
  return (
    <Tag
      size="sm"
      tone={tones[notice]}
      title={t(`assistant.notice.${notice}.detail`)}
    >
      {t(`assistant.notice.${notice}`)}
    </Tag>
  );
}
