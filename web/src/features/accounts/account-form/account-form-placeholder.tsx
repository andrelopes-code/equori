import { PageBody } from "@slotted/react/page";
import { Skeleton } from "@slotted/react/skeleton";
import { Stack } from "@slotted/react/stack";

// The form's fields while the lists it chooses from load: a label and a control each.
export function AccountFormPlaceholder() {
  return (
    <PageBody>
      <Stack gap={6} aria-busy="true">
        {[40, 55, 30].map((width) => (
          <Stack key={width} gap={2}>
            <Skeleton shape="text" inlineSize={`${String(width)}%`} />
            <Skeleton shape="block" blockSize="2.5rem" />
          </Stack>
        ))}
      </Stack>
    </PageBody>
  );
}
