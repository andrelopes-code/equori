import { InlineMessage } from "@slotted/react/inline-message";
import { Inline } from "@slotted/react/inline";
import { Stack } from "@slotted/react/stack";
import { Tag } from "@slotted/react/tag";

import type { ModelUse } from "@/features/setup/api";
import { NoticeTag } from "@/features/setup/notice-tag";
import { useT } from "@/i18n/i18n-provider";

// What a use sends and where: financial data, the capabilities it needs, the notice of each
// target and a warning where a target trains on financial data (ADR 019).
export function UsePrivacy({ use }: { use: ModelUse }) {
  const t = useT();
  const capability = (c: ModelUse["needs"][number]) =>
    t(`assistant.capability.${c}`);
  const training = [
    ...new Set(
      use.targets
        .filter((x) => x.notice === "trains")
        .map((x) => x.provider_name),
    ),
  ];
  const lacking = use.targets
    .map((x) => ({
      name: x.provider_name,
      missing: use.needs.filter((c) => !x.capabilities.includes(c)),
    }))
    .filter((x) => x.missing.length > 0);

  return (
    <Stack gap={2}>
      <Inline gap={2} wrap="wrap">
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
          <Tag size="sm" tone="secondary">
            {t("assistant.chain.needs", {
              list: use.needs.map(capability).join(", "),
            })}
          </Tag>
        )}
        {use.targets.map((x) => (
          <NoticeTag key={`${x.provider_id}/${x.model}`} notice={x.notice} />
        ))}
      </Inline>
      {use.sends_financial_data && training.length > 0 && (
        <InlineMessage tone="warning">
          {t("assistant.use.trains", { provider: training.join(", ") })}
        </InlineMessage>
      )}
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
