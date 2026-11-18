import { Text } from "@slotted/react/typography";
import type { ReactNode } from "react";

import { HelpAnchor } from "@/features/help/row/help-anchor";
import styles from "@/features/help/styles/help.module.css";

interface HelpRowProps {
  page: string;
  // The id of a section or of a term of the page.
  hash?: string | undefined;
  title: ReactNode;
  // What stands at the end of the row: the kind of the page, or where the row leads.
  end?: string;
  // The word "video" of a page that has one.
  media?: string | undefined;
}

// Families read: list-item (its height follows the content and its end slot holds one element).
// Every link of the help that stands as a row has one height, one inset and one hover (help
// spec, HP13); this screen's form.
export function HelpRow({ page, hash, title, end, media }: HelpRowProps) {
  return (
    <li>
      <HelpAnchor
        className={[styles.row, styles.entryLink].join(" ")}
        page={page}
        hash={hash}
      >
        <span className={styles.rowTitle}>{title}</span>
        {media !== undefined && (
          <span className={styles.rowMedia}>
            <Text
              size="sm"
              tone="muted"
              render={(props) => <span {...props} />}
            >
              {media}
            </Text>
          </span>
        )}
        {end !== undefined && (
          <Text
            size="sm"
            tone="muted"
            className={styles.rowEnd}
            render={(props) => <span {...props} />}
          >
            {end}
          </Text>
        )}
      </HelpAnchor>
    </li>
  );
}
