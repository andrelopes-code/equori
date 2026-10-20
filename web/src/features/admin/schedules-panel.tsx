import { Grid } from "@slotted/react/grid";
import { Stack } from "@slotted/react/stack";
import { useState } from "react";

import type { components } from "@/api/schema.gen";
import { RecordSelect, recordOptions } from "@/features/admin/record-select";
import { LeafEditor } from "@/features/admin/leaf-editor";
import { OperationList } from "@/features/admin/operation-list";
import { operations } from "@/features/admin/operations";
import { QueryTable } from "@/features/admin/query-table";
import type { Row } from "@/features/admin/record-table";
import { TitledSection } from "@/features/admin/titled-section";
import type { AdminContext } from "@/features/admin/use-admin-context";
import { useT } from "@/i18n/i18n-provider";
import { shiftDate } from "@/i18n/format";

type Projection = components["schemas"]["Projection"];

const filterNames = ["from", "to", "schedule_id", "state", "month"] as const;
type Filters = Record<(typeof filterNames)[number], string>;

// The opening and closing balances stand as the first and last rows around the points; a body
// of another shape shows as one row.
function projectionRows(body: unknown): Row[] {
  const projection = body as Partial<Projection> | null;
  if (projection === null || !Array.isArray(projection.points)) {
    return body === null ? [] : [body as Row];
  }
  return [
    { date: projection.from, balance: projection.opening },
    ...projection.points,
    { date: projection.to, balance: projection.closing },
  ];
}

export function SchedulesPanel({ ctx }: { ctx: AdminContext }) {
  const t = useT();
  const [filters, setFilters] = useState<Filters>({
    from: shiftDate(ctx.refs.today, -31),
    to: shiftDate(ctx.refs.today, 92),
    schedule_id: "",
    state: "",
    month: ctx.refs.month,
  });
  const [account, setAccount] = useState(ctx.refs.account("checking"));
  const occurrences = {
    from: filters.from,
    to: filters.to,
    schedule_id: filters.schedule_id,
    state: filters.state,
  };

  return (
    <Stack gap={6}>
      <QueryTable
        caption="schedules"
        path="/schedules"
        query={{ limit: "200" }}
        cells={ctx.cells}
      />
      <Grid gap={3} minItemWidth="sm">
        {filterNames.map((name) => (
          <LeafEditor
            key={name}
            name={name}
            value={filters[name]}
            onChange={(value) => {
              setFilters((current) => ({ ...current, [name]: String(value) }));
            }}
            ctx={ctx}
          />
        ))}
      </Grid>
      <QueryTable
        caption="occurrences"
        path="/occurrences"
        query={occurrences}
        cells={ctx.cells}
      />
      <QueryTable
        caption="commitments"
        path="/commitments"
        query={{ month: filters.month }}
        cells={ctx.cells}
      />
      <RecordSelect
        label={t("admin.schedules.projection")}
        options={recordOptions(ctx.accounts)}
        value={account}
        onChange={setAccount}
      />
      {account !== "" && (
        <QueryTable
          caption="projection"
          path={`/accounts/${account}/projection`}
          query={{ to: filters.to }}
          cells={ctx.cells}
          pick={projectionRows}
        />
      )}
      <TitledSection title={t("admin.ops")}>
        <OperationList
          ops={operations.schedules}
          ctx={ctx}
          initial={{ from: filters.from, to: filters.to, month: filters.month }}
        />
      </TitledSection>
    </Stack>
  );
}
