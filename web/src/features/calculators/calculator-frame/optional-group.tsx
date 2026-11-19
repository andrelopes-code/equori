import type { ReactNode } from "react";

import { OptionalGroups } from "@/features/calculators/calculator-frame/optional-groups";

interface OptionalGroupProps<K extends string> {
  // The address keys of the group's inputs; the group is open while any of them is present.
  keys: readonly NoInfer<K>[];
  addressKeys: readonly K[];
  add: string;
  legend: string;
  remove: string;
  children: ReactNode;
}

// One optional group: the case of OptionalGroups with a single group.
export function OptionalGroup<K extends string>({
  addressKeys,
  ...group
}: OptionalGroupProps<K>) {
  return <OptionalGroups groups={[group]} addressKeys={addressKeys} />;
}
