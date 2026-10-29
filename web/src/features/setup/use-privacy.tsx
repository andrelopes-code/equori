import { InlineMessage } from "@slotted/react/inline-message";
import { Inline } from "@slotted/react/inline";
import { Stack } from "@slotted/react/stack";
import { Tag } from "@slotted/react/tag";

import type { ModelUse } from "@/features/setup/api";
import { NoticeTag } from "@/features/setup/notice-tag";
import { useT } from "@/i18n/i18n-provider";

// What a use sends and where: financial data, the capabilities it needs, one tag per notice of its
// targets, and the capabilities a target lacks. The warning that a target trains on financial data
// is the section's, stated once (ADR 019).
export function UsePrivacy({ use }: { use: ModelUse }) {
  const t = useT();
  const capability = (c: ModelUse["needs"][number]) =>
    t(`assistant.capability.${c}`);
  const lacking = use.targets
    .map((x) => ({
      name: x.provider_name,
      missing: use.needs.filter((c) => !x.capabilities.includes(c)),
    }))
    .filter((x) => x.missing.length > 0);

  return (
    <Stack gap={2}>
      <Inline gap={4} wrap="wrap">
        <Tag
          size="sm"
          tone={use.sends_financial_data ? "secondary" : "success"}
        >
          {t(
            use.sends_financial_data
              ? "assistant.use.sends"
              : "assistant.use.local",
          )}
        </Tag>
        {use.needs.length > 0 && (
          <Tag
            size="sm"
            tone="secondary"
            title={use.needs
              .map((c) => t(`assistant.capability.${c}.hint`))
              .join(" ")}
          >
            {t("assistant.chain.needs", {
              list: use.needs.map(capability).join(", "),
            })}
          </Tag>
        )}
        {[...new Set(use.targets.map((x) => x.notice))].map((notice) => (
          <NoticeTag key={notice} notice={notice} />
        ))}
      </Inline>
      {lacking.map((x) => (
        <InlineMessage key={x.name} tone="danger">
          {t("assistant.use.lacks", {
            provider: x.name,
            list: x.missing.map(capability).join(", "),
          })}
        </InlineMessage>
      ))}
    </Stack>
  );
}
