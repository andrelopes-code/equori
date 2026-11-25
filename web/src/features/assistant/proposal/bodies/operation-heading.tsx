import { Text } from "@slotted/react/typography";

import type { components } from "@/api/schema.gen";
import { changeOf } from "@/features/assistant/proposal/preview-field";
import styles from "@/features/assistant/proposal/decision-sheet.module.css";
import { operationTitle } from "@/features/assistant/proposal/ticket/operation-title";
import { useValueText } from "@/features/assistant/proposal/use-value-text";
import { useT } from "@/i18n/i18n-provider";

type Proposal = components["schemas"]["AssistantProposal"];

interface OperationHeadingProps {
  proposal: Proposal;
  // An investment operation: what holds it goes under its title.
  ticket: boolean;
}

// Families read: typography. The title of a row of the sheet with the tags that qualify it.
export function OperationHeading({ proposal, ticket }: OperationHeadingProps) {
  const t = useT();
  const valueText = useValueText();
  const { preview } = proposal;
  const holder = ticket ? holderOf(proposal) : undefined;

  return (
    <span className={styles.opHeading}>
      <span className={styles.opTitle}>
        <Text className={styles.titleText} size="md" weight="semibold">
          {operationTitle(preview, t)}
        </Text>
        {proposal.suggested && (
          <span className={styles.tag}>
            {t("assistant.proposal.suggested")}
          </span>
        )}
        {preview.destructive === true && (
          <span className={styles.tagDanger}>
            {t("assistant.sheet.irreversible_tag")}
          </span>
        )}
      </span>

      {holder !== undefined && (
        <Text className={styles.titleText} size="xs" tone="muted">
          {valueText({ text: holder })}
        </Text>
      )}
    </span>
  );
}

// The brokerage of a contract, else the target. A custody transfer names both brokerages below.
function holderOf({ preview }: Proposal): string | undefined {
  if (preview.action === "transfer_custody") return undefined;

  return changeOf(preview, "institution")?.after?.text ?? preview.target;
}
