import { Card, CardBody, CardHeader } from "@slotted/react/card";
import { Skeleton } from "@slotted/react/skeleton";
import { Stack } from "@slotted/react/stack";

// The card of a goal not known yet, in the parts of goal-card.tsx: the name, the saved amount under
// its label, the meter and the line of facts.
export function GoalCardPlaceholder() {
  return (
    <Card fill="outline">
      <CardHeader>
        <Skeleton shape="block" inlineSize="55%" blockSize={16} />
      </CardHeader>

      <CardBody>
        <Stack gap={6}>
          <Stack gap={3}>
            <Skeleton shape="block" inlineSize={64} blockSize={12} />
            <Skeleton shape="block" inlineSize="45%" blockSize={20} />
          </Stack>

          <Skeleton shape="block" blockSize={8} />
          <Skeleton shape="block" inlineSize="80%" blockSize={12} />
        </Stack>
      </CardBody>
    </Card>
  );
}
