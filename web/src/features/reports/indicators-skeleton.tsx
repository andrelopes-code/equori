import { Skeleton } from "@slotted/react/skeleton";
import { Stack } from "@slotted/react/stack";

// The shape of the tab while its read is under way: the verdict card, the position board and the
// three charts, each in the height of the block it stands for.
export function IndicatorsSkeleton() {
  return (
    <Stack gap={4}>
      <Skeleton shape="block" blockSize="9rem" />
      <Skeleton shape="block" blockSize="22rem" />
      <Skeleton shape="block" blockSize="16rem" />
      <Skeleton shape="block" blockSize="16rem" />
    </Stack>
  );
}
