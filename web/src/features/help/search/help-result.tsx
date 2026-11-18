import { Text } from "@slotted/react/typography";

import { HelpAnchor } from "@/features/help/row/help-anchor";
import { HelpMark } from "@/features/help/search/help-mark";
import type { HelpHit } from "@/features/help/search/search-help";
import { useHitPlace } from "@/features/help/search/use-hit-place";
import styles from "@/features/help/styles/help.module.css";

interface HelpResultProps {
  hit: HelpHit;
  query: string;
  active: boolean;
}

// One result: its title and where it stands, then the sentence that holds the match.
export function HelpResult({ hit, query, active }: HelpResultProps) {
  const place = useHitPlace();

  return (
    <li>
      <HelpAnchor
        className={[styles.row, styles.resultLink].join(" ")}
        page={hit.page}
        hash={hit.hash}
        active={active}
      >
        <span className={styles.resultTitle}>
          <span className={styles.rowTitle}>
            <HelpMark text={hit.title} query={query} />
          </span>
          <Text
            size="sm"
            tone="muted"
            className={styles.rowEnd}
            render={(props) => <span {...props} />}
          >
            {place(hit)}
          </Text>
        </span>
        <Text
          size="sm"
          tone="muted"
          className={styles.resultExcerpt}
          render={(props) => <span {...props} />}
        >
          <HelpMark text={hit.excerpt} query={query} />
        </Text>
      </HelpAnchor>
    </li>
  );
}
