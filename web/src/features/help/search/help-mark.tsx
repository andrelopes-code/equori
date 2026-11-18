import { hitRanges } from "@/features/help/search/search-help";
import styles from "@/features/help/styles/help.module.css";

interface HelpMarkProps {
  text: string;
  query: string;
}

// A text with the words the search matched marked in it.
export function HelpMark({ text, query }: HelpMarkProps) {
  const ranges = hitRanges(text, query);
  const starts = [0, ...ranges.map(([, end]) => end)];

  return (
    <>
      {ranges.map(([start, end], index) => (
        <span key={start}>
          {text.slice(starts[index], start)}
          <mark className={styles.hit}>{text.slice(start, end)}</mark>
        </span>
      ))}
      {text.slice(starts.at(-1))}
    </>
  );
}
