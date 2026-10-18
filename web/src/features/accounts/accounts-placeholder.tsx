import { Skeleton, SkeletonRegion } from "@slotted/react/skeleton";

export function AccountsPlaceholder() {
  return (
    <SkeletonRegion>
      {[0, 1, 2, 3].map((row) => (
        <Skeleton key={row} shape="text" inlineSize="60%" />
      ))}
    </SkeletonRegion>
  );
}
