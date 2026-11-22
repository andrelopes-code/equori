import { Link } from "@slotted/react/link";

import { sourceLinks } from "@/features/assistant/view/forms/more/source-links";
import type { FormBodyProps } from "@/features/assistant/view/view-forms";
import styles from "@/features/assistant/view/forms/forms.module.css";

// The pages of the web an answer cites (web search design, S7): one line per source, its title
// as a link that opens in a new tab and the host it leads to.
export function SourcesBody({ data }: FormBodyProps) {
  const sources = sourceLinks(data);

  return (
    <ol className={styles.steps}>
      {sources.map((s, index) => (
        <li key={s.url}>
          <span className={styles.stepN}>{index + 1}</span>
          <Link external href={s.url} className={styles.rowName}>
            {s.title}
          </Link>
          <span className={styles.sourceHost}>{s.host}</span>
        </li>
      ))}
    </ol>
  );
}
