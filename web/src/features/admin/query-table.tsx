import { useQuery } from "@tanstack/react-query";
import { Text } from "@slotted/react/typography";

import { useApi } from "@/api/api-context";
import { adminQuery, CallError } from "@/features/admin/api";
import type { CellContext } from "@/features/admin/cell-text";
import { RecordTable } from "@/features/admin/record-table";
import type { Row } from "@/features/admin/record-table";
import { ResponseView } from "@/features/admin/response-view";
import { useT } from "@/i18n/i18n-provider";

// A list response shows its items; any other object shows as one row.
function rowsOf(body: unknown, pick?: (body: unknown) => Row[]): Row[] {
  if (pick !== undefined) return pick(body);
  if (typeof body !== "object" || body === null) return [];
  const items = (body as { items?: unknown }).items;
  return Array.isArray(items) ? (items as Row[]) : [body as Row];
}

export function QueryTable({
  caption,
  path,
  query,
  cells,
  pick,
  columns,
}: {
  caption: string;
  path: string;
  query?: Readonly<Record<string, string>>;
  cells: CellContext;
  pick?: (body: unknown) => Row[];
  columns?: readonly string[];
}) {
  const t = useT();
  const api = useApi();
  const result = useQuery({
    ...adminQuery(api, path, query),
    retry: false,
  });
  if (result.error instanceof CallError) {
    return (
      <ResponseView
        result={result.error.result}
        caption={caption}
        cells={cells}
      />
    );
  }
  if (result.error !== null) {
    return <Text tone="danger">{String(result.error)}</Text>;
  }
  if (result.data === undefined) {
    return <Text tone="muted">{t("admin.loading")}</Text>;
  }
  return (
    <RecordTable
      caption={caption}
      rows={rowsOf(result.data, pick)}
      cells={cells}
      {...(columns === undefined ? {} : { columns })}
    />
  );
}
