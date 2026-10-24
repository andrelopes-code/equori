import { IconButton } from "@slotted/react/button";
import { Glyph, Icon } from "@slotted/react/icon";
import { Text } from "@slotted/react/typography";

import { AssistantIcon } from "@/features/assistant/assistant-icon";
import styles from "@/features/assistant/assistant-panel.module.css";
import { useT } from "@/i18n/i18n-provider";

// Workaround for Slotted finding "The drawer header has no slot for actions beside the title": the conversation's title and its actions stand in a bar of the panel's own at the top of the body.
export function PanelBar({
  title,
  listing,
  onBack,
  onHistory,
  onNew,
}: {
  title: string;
  listing: boolean;
  onBack: () => void;
  onHistory: () => void;
  onNew: () => void;
}) {
  const t = useT();
  return (
    <div className={styles.bar}>
      {listing && (
        <IconButton aria-label={t("assistant.back")} size="sm" onClick={onBack}>
          <Icon directional>
            <Glyph name="arrow-left" />
          </Icon>
        </IconButton>
      )}
      <Text weight="medium" truncate className={styles.barTitle}>
        {title}
      </Text>
      {!listing && (
        <IconButton
          aria-label={t("assistant.history")}
          size="sm"
          onClick={onHistory}
        >
          <Icon>
            <AssistantIcon name="history" />
          </Icon>
        </IconButton>
      )}
      <IconButton
        aria-label={t("assistant.new_conversation")}
        size="sm"
        onClick={onNew}
      >
        <Icon>
          <AssistantIcon name="new" />
        </Icon>
      </IconButton>
    </div>
  );
}
