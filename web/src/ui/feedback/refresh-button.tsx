import { IconButton } from "@slotted/react/button";
import { Glyph, Icon } from "@slotted/react/icon";

export function RefreshButton({
  label,
  refreshing,
  onRefresh,
}: {
  label: string;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  return (
    <IconButton
      aria-label={label}
      variant="ghost"
      tone="secondary"
      loading={refreshing}
      onClick={onRefresh}
    >
      <Icon>
        <Glyph name="rotate-ccw" />
      </Icon>
    </IconButton>
  );
}
