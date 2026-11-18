import { Highlight } from "@slotted/react/highlight";

import { hitRanges } from "@/features/help/search/search-help";

interface HelpMarkProps {
  text: string;
  query: string;
}

// A text with the words the search matched marked in it. The ranges come from the search itself,
// so a word found with one changed letter is marked too.
export function HelpMark({ text, query }: HelpMarkProps) {
  return <Highlight text={text} ranges={hitRanges(text, query)} />;
}
