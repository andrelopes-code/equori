import { Skeleton } from "@slotted/react/skeleton";

interface PendingValueProps {
  // The width of the value it stands for, in characters.
  ch: number;
}

export function PendingValue({ ch }: PendingValueProps) {
  return <Skeleton shape="text" inlineSize={`${String(ch)}ch`} />;
}
