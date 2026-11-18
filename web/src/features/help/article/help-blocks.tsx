import { HelpBlock } from "@/features/help/article/help-block";
import type { HelpBlock as Block } from "@/features/help/model/parse-help-page";

interface HelpBlocksProps {
  blocks: readonly Block[];
}

// The blocks of a section, in the order the page writes them.
export function HelpBlocks({ blocks }: HelpBlocksProps) {
  return blocks.map((block, index) => (
    <HelpBlock
      // A page is static text: the place of a block is its identity.
      key={`${String(index)}${block.type}`}
      block={block}
      outcome={block.type === "text" && walks(blocks[index - 1])}
    />
  ));
}

function walks(block: Block | undefined): boolean {
  return (
    block?.type === "steps" && block.steps.some((s) => s.figure !== undefined)
  );
}
