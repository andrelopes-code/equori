import { TableCell } from "@slotted/react/table";
import { Text } from "@slotted/react/typography";

import { DriftTrack } from "@/features/portfolio/contribution-plan/drift-track";
import { TargetSlider } from "@/features/portfolio/contribution-plan/target-slider";
import { useT } from "@/i18n/i18n-provider";

interface TrackCellProps {
  name: string;
  current: number | undefined;
  after: number | undefined;
  target: number | undefined;
  scale: number;
  position: number;
  // A class without a name says so in place of its track.
  blank?: boolean;
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
  blank,
  slider,
}: TrackCellProps) {
  const t = useT();

  if (blank === true) {
    return (
      <TableCell>
        <Text tone="danger" size="xs">
          {t("contributionPlan.nameRequired")}
        </Text>
      </TableCell>
    );
  }

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
