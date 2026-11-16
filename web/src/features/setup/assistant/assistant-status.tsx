import { Heading, Text } from "@slotted/react/typography";

import type { ModelUse, UsageRow } from "@/features/setup/api";
import styles from "@/features/setup/assistant/assistant-status.module.css";
import { answering } from "@/features/setup/assistant/use-answer";
import { useT } from "@/i18n/i18n-provider";
import { compactQuery, useMediaQuery } from "@/ui/runtime/use-media-query";

interface AssistantStatusProps {
  uses: readonly ModelUse[];
  rows: readonly UsageRow[];
  now: Date;
}

const chatUse = "assistant.chat";

// The answer the reader opens the pane for (spec A2): which model answers the conversation now,
// its provider, and the providers whose free tier trains on what a use sends.
export function AssistantStatus({ uses, rows, now }: AssistantStatusProps) {
  const t = useT();
  const compact = useMediaQuery(compactQuery);

  const chat = uses.find((use) => use.id === chatUse);
  const target = chat === undefined ? undefined : answering(chat, rows, now);
  const training = [
    ...new Set(
      uses
        .filter((use) => use.sends_financial_data)
        .flatMap((use) => use.targets)
        .filter((x) => x.notice === "trains")
        .map((x) => x.provider_name),
    ),
  ];

  return (
    <section className={styles.status} aria-label={t("assistant.status")}>
      <Heading level={3} size={compact ? "2xl" : "3xl"}>
        {target === undefined && t("assistant.status.none")}
        {target !== undefined && (
          <>
            {t("assistant.status.answers")}{" "}
            <span className={styles.model}>{target.model}</span>
          </>
        )}
      </Heading>

      <div className={styles.facts}>
        {target !== undefined && (
          <Text size="sm" tone="muted" truncate>
            {t("assistant.status.provider", { name: target.provider_name })}
          </Text>
        )}
        {training.length > 0 && (
          <Text size="sm" tone="warning" truncate>
            {t("assistant.use.trains", { provider: training.join(", ") })}
          </Text>
        )}
      </div>
    </section>
  );
}
