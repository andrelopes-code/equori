import { Inline } from "@slotted/react/inline";

import { HelpPagerLink } from "@/features/help/help-pager-link";
import styles from "@/features/help/help-page.module.css";
import { helpNeighbours } from "@/features/help/help-pages";

interface HelpPagerProps {
  page: string;
}

// The way on to the page before and the page after, at the two ends of the text's line.
export function HelpPager({ page }: HelpPagerProps) {
  const { previous, next } = helpNeighbours(page);

  return (
    <Inline justify="between" align="start" gap={6} wrap="wrap">
      {previous !== undefined && (
        <HelpPagerLink id={previous.id} direction="previous" />
      )}
      {next !== undefined && (
        <div className={styles.next}>
          <HelpPagerLink id={next.id} direction="next" />
        </div>
      )}
    </Inline>
  );
}
