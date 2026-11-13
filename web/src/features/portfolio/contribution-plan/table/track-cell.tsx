import { TableCell } from "@slotted/react/table";

import { DriftTrack } from "@/features/portfolio/contribution-plan/table/drift-track";
import { TargetSlider } from "@/features/portfolio/contribution-plan/table/target-slider";

interface TrackCellProps {
  name: string;
  current: number | undefined;
  after: number | undefined;
  target: number | undefined;
  scale: number;
  position: number;
  // Edit mode: the slider of the target replaces the track.
  slider?: { disabled: boolean; onChange: (bp: number) => void } | undefined;
}

// The track column of a row: the drift track, or in edit mode the slider of the target.
export function TrackCell({
  name,
  current,
  after,
  target,
  scale,
  position,
  slider,
}: TrackCellProps) {
  if (slider !== undefined && target !== undefined) {
    return (
      <TableCell>
        <TargetSlider
          name={name}
          value={target}
          disabled={slider.disabled}
          onChange={slider.onChange}
        />
      </TableCell>
    );
  }

  return (
    <TableCell>
      <DriftTrack
        name={name}
        current={current}
        after={after}
        target={target}
        scale={scale}
        position={position}
      />
    </TableCell>
  );
}
