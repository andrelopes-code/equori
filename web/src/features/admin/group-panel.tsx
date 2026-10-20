import { Stack } from "@slotted/react/stack";

import { OperationList } from "@/features/admin/operation-list";
import { operations } from "@/features/admin/operations";
import type { GroupKey } from "@/features/admin/operations";
import { QueryTable } from "@/features/admin/query-table";
import { TitledSection } from "@/features/admin/titled-section";
import type { AdminContext } from "@/features/admin/use-admin-context";

export interface ListSource {
  path: string;
  query?: Readonly<Record<string, string>>;
}

const listQuery = { limit: "200" };

export function GroupPanel({
  ctx,
  lists,
  groups,
}: {
  ctx: AdminContext;
  lists: readonly ListSource[];
  groups: readonly GroupKey[];
}) {
  return (
    <Stack gap={6}>
      {lists.map((list) => (
        <QueryTable
          key={list.path}
          caption={list.path}
          path={list.path}
          query={list.query ?? listQuery}
          cells={ctx.cells}
        />
      ))}
      {groups.map((group) => (
        <TitledSection key={group} title={group}>
          <OperationList ops={operations[group]} ctx={ctx} />
        </TitledSection>
      ))}
    </Stack>
  );
}
