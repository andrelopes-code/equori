import styles from "@/features/cards/card-tile/statement-ticket.module.css";
import { useT } from "@/i18n/i18n-provider";

interface TicketToggleProps {
  open: boolean;
  title: string;
  onClick: () => void;
}

// A chevron button; its hit area reaches 44 px through a pseudo-element (rule M5).
export function TicketToggle({ open, title, onClick }: TicketToggleProps) {
  const t = useT();

  return (
    <button
      type="button"
      className={styles.toggle}
      aria-expanded={open}
      aria-label={t("cards.ticket.details", { title })}
      onClick={onClick}
    >
      <svg
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M3.5 6l4.5 4.5L12.5 6" />
      </svg>
    </button>
  );
}
