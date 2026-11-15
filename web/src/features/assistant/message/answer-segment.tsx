import { Markdown } from "@slotted/react/markdown";

import type { AnswerSegment as Segment } from "@/features/assistant/message/answer-blocks";
import { CompareBlock } from "@/features/assistant/message/compare-block";
import { RankingBlock } from "@/features/assistant/message/ranking-block";
import { SeriesBlock } from "@/features/assistant/message/series-block";
import { screenLinks } from "@/navigation/screen-links";

interface AnswerSegmentProps {
  segment: Segment;
}

// One part of an answer: Markdown, or the block drawn from a table.
export function AnswerSegment({ segment }: AnswerSegmentProps) {
  if (segment.kind === "compare") {
    return <CompareBlock head={segment.head} rows={segment.rows} />;
  }

  if (segment.kind === "ranking") {
    return (
      <RankingBlock
        head={segment.head}
        rows={segment.rows}
        numbered={segment.numbered}
      />
    );
  }

  if (segment.kind === "series") {
    return <SeriesBlock head={segment.head} rows={segment.rows} />;
  }

  return <Markdown tree={segment.tree} size="lg" renderers={screenLinks} />;
}
