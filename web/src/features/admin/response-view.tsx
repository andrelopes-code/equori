import { CodeBlock } from "@slotted/react/code-block";
import { Stack } from "@slotted/react/stack";
import { Text } from "@slotted/react/typography";

import type { CallResult } from "@/features/admin/api";
import type { CellContext } from "@/features/admin/cell-text";
import { RecordTable } from "@/features/admin/record-table";
import type { Row } from "@/features/admin/record-table";

function rowsOf(body: unknown): Row[] | null {
  if (typeof body !== "object" || body === null) return null;
  const items = (body as { items?: unknown }).items;
  return Array.isArray(items) ? (items as Row[]) : null;
}

export function ResponseView({
  result,
  caption,
  cells,
}: {
  result: CallResult;
  caption: string;
  cells: CellContext;
}) {
  const rows = rowsOf(result.body);
  const ok = result.status < 400;
  return (
    <Stack gap={3}>
      <Text weight="semibold" tone={ok ? "success" : "danger"}>
        {String(result.status)}
      </Text>
      {rows !== null && (
        <RecordTable caption={caption} rows={rows} cells={cells} />
      )}
      {result.body !== undefined && (
        <CodeBlock
          code={JSON.stringify(result.body, null, 2)}
          language="json"
          maxLines={40}
        />
      )}
    </Stack>
  );
}
