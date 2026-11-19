import type { ReactNode } from "react";

import { OptionalGroups } from "@/features/calculators/calculator-frame/optional-groups";

interface OptionalGroupProps {
  // The address keys of the group's inputs; the group is open while any of them is present.
  keys: string[];
  add: string;
  legend: string;
  remove: string;
  children: ReactNode;
}

// One optional group: the case of OptionalGroups with a single group.
export function OptionalGroup(props: OptionalGroupProps) {
  return <OptionalGroups groups={[props]} />;
}
