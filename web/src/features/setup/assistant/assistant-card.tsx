import { Heading, Text } from "@slotted/react/typography";
import type { ReactNode } from "react";

import styles from "@/features/setup/assistant/assistant-card.module.css";

interface AssistantCardProps {
  title: string;
  description: string;
  actions?: ReactNode;
  children: ReactNode;
}

// A card of the assistant pane (spec A4, A5): its title, what it holds and its rows.
// Element of the app's own. Families read: Card (its body insets the rows, so a rule between
// rows stops short of the card's edge) and List (an item has no fixed height and wraps its
// description). The card takes the panel material of O18.
export function AssistantCard({
  title,
  description,
  actions,
  children,
}: AssistantCardProps) {
  return (
    <section className={styles.card} aria-label={title}>
      <header className={styles.head}>
        <div className={styles.title}>
          <Heading level={3} size="md" truncate>
            {title}
          </Heading>
          <Text size="sm" tone="muted" truncate className={styles.description}>
            {description}
          </Text>
        </div>

        {actions}
      </header>

      <ul className={styles.rows} aria-label={title}>
        {children}
      </ul>
    </section>
  );
}
