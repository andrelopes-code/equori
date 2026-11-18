import { Markdown } from "@slotted/react/markdown";

import { HelpFigure } from "@/features/help/figure/help-figure";
import type { HelpBlock as Block } from "@/features/help/model/parse-help-page";
import { HelpWalk } from "@/features/help/steps/help-walk";
import styles from "@/features/help/styles/help.module.css";
import { screenLinks } from "@/navigation/screen-links";

interface HelpBlockProps {
  block: Block;
  // The text that follows steps with figures says what they lead to, set apart by two rules.
  outcome?: boolean;
}

// One block of a page: text, steps, a figure, a glossary term or a pointer.
export function HelpBlock({ block, outcome = false }: HelpBlockProps) {
  if (block.type === "steps") {
    return <HelpWalk steps={block.steps} video={block.video} />;
  }

  if (block.type === "figure") return <HelpFigure figure={block.figure} />;

  if (block.type === "term") {
    return (
      <div id={block.id}>
        <Markdown
          source={`**${block.term}**: ${block.markdown}`}
          size="lg"
          renderers={screenLinks}
        />
      </div>
    );
  }

  return (
    <div className={outcome ? styles.outcome : undefined}>
      <Markdown source={block.markdown} size="lg" renderers={screenLinks} />
    </div>
  );
}
