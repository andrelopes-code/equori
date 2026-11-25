import { VisuallyHidden } from "@slotted/react/visually-hidden";

import styles from "@/features/assistant/proposal/ticket/ticket.module.css";
import { useT } from "@/i18n/i18n-provider";

interface TicketValueProps {
  text: string | undefined;
  // The value a correction replaces.
  was: string | undefined;
}

// Families read: visually-hidden. A value, after the one it replaces, struck.
export function TicketValue({ text, was }: TicketValueProps) {
  const t = useT();

  if (was === undefined) return text;

  return (
    <>
      <s className={styles.was}>
        <VisuallyHidden>{t("assistant.change.before")}</VisuallyHidden>
        {was}
      </s>{" "}
      <VisuallyHidden>{t("assistant.change.after")}</VisuallyHidden>
      {text}
    </>
  );
}
