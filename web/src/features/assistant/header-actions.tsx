import { IconButton } from "@slotted/react/button";
import { Glyph, Icon } from "@slotted/react/icon";

import { AssistantIcon } from "@/features/assistant/assistant-icon";
import styles from "@/features/assistant/assistant-panel.module.css";
import { useT } from "@/i18n/i18n-provider";

// Workaround for Slotted finding "The drawer header has no slot for actions beside the title": the header's second column holds this group, the close included, in place of the drawer's own close.
export function HeaderActions({
  listing,
  onBack,
  onHistory,
  onNew,
  onClose,
}: {
  listing: boolean;
  onBack: () => void;
  onHistory: () => void;
  onNew: () => void;
  onClose: () => void;
}) {
  const t = useT();
  return (
    <div className={styles.headerActions}>
      {listing ? (
        <IconButton aria-label={t("assistant.back")} onClick={onBack}>
          <Icon directional>
            <Glyph name="arrow-left" />
          </Icon>
        </IconButton>
      ) : (
        <IconButton aria-label={t("assistant.history")} onClick={onHistory}>
          <Icon>
            <AssistantIcon name="history" />
          </Icon>
        </IconButton>
      )}
      <IconButton aria-label={t("assistant.new_conversation")} onClick={onNew}>
        <Icon>
          <AssistantIcon name="new" />
        </Icon>
      </IconButton>
      <IconButton aria-label={t("detail.close")} onClick={onClose}>
        <Icon>
          <Glyph name="x" />
        </Icon>
      </IconButton>
    </div>
  );
}
