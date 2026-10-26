import { Inline } from "@slotted/react/inline";
import type { ReactNode } from "react";

// The row of a report's own controls under the header, as the categories page lays out its
// class and archived controls: the segmented choices at the start, the selects and switches at
// the end. It wraps below the width of both, and the stack that holds it keeps the gap to the
// report.
export function ReportControls({
  start,
  middle,
  end,
}: {
  start?: ReactNode;
  // A second control beside start.
  middle?: ReactNode;
  end?: ReactNode;
}) {
  return (
    <Inline gap={4} justify="between" align="center" wrap="wrap">
      {middle === undefined ? (
        start
      ) : (
        <Inline gap={4} align="center" wrap="wrap">
          {start}
          {middle}
        </Inline>
      )}
      <Inline gap={4} align="center" wrap="wrap">
        {end}
      </Inline>
    </Inline>
  );
}
