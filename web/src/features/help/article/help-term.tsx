import { Markdown } from "@slotted/react/markdown";

import styles from "@/features/help/styles/help.module.css";
import { screenLinks } from "@/navigation/screen-links";

interface HelpTermProps {
  id: string;
  term: string;
  markdown: string;
}

// One term of the glossary: the word in the strong ink above its meaning, and the anchor a link
// to the term lands on.
export function HelpTerm({ id, term, markdown }: HelpTermProps) {
  return (
    <div className={styles.gloss} id={id}>
      <h3 className={styles.glossWord}>{term}</h3>
      <div className={styles.glossText}>
        <Markdown source={markdown} size="lg" renderers={screenLinks} />
      </div>
    </div>
  );
}
