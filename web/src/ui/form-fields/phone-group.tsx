import { Stack } from "@slotted/react/stack";
import { Text } from "@slotted/react/typography";
import type { ReactNode } from "react";

// Below 600 px a group of records is a heading with its total, then one surface of rows.
export function PhoneGroup({
  label,
  end,
  children,
}: {
  label: string;
  end?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Stack gap={2}>
      <Stack gap={0}>
        <Text size="md" weight="semibold">
          {label}
        </Text>
        {end !== undefined && (
          <Text size="sm" tone="muted">
            {end}
          </Text>
        )}
      </Stack>
      {children}
    </Stack>
  );
}
