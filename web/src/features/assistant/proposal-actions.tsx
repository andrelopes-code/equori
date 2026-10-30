import { Button } from "@slotted/react/button";
import { Text } from "@slotted/react/typography";
import type { Ref } from "react";

import styles from "@/features/assistant/assistant-panel.module.css";
import { useAppLocale, useT } from "@/i18n/i18n-provider";

interface ProposalActionsProps {
  expiresAt: string;
  destructive: boolean;
  busy: boolean;
  confirming: boolean;
  rejecting: boolean;
  onConfirm: () => void;
  onReject: () => void;
  ref?: Ref<HTMLDivElement>;
}

// Families read: button, typography. The two decisions of a waiting proposal, after the hour it
// expires.
export function ProposalActions({
  expiresAt,
  destructive,
  busy,
  confirming,
  rejecting,
  onConfirm,
  onReject,
  ref,
}: ProposalActionsProps) {
  const t = useT();
  const [locale] = useAppLocale();
  const time = new Intl.DateTimeFormat(locale, {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(expiresAt));

  return (
    <div className={styles.proposalActions} ref={ref}>
      <Text size="xs" tone="muted">
        {t("assistant.proposal.expires", { time })}
      </Text>

      <span className={styles.proposalButtons}>
        <Button
          size="sm"
          variant="ghost"
          tone="secondary"
          disabled={busy}
          loading={rejecting}
          onClick={onReject}
        >
          {t("assistant.proposal.reject")}
        </Button>
        <Button
          size="sm"
          tone={destructive ? "danger" : "accent"}
          disabled={busy}
          loading={confirming}
          onClick={onConfirm}
        >
          {t("assistant.proposal.confirm")}
        </Button>
      </span>
    </div>
  );
}
