import { Stack } from "@slotted/react/stack";
import { useState } from "react";

import { OperationForm, operationTitle } from "@/features/admin/operation-form";
import type { Operation } from "@/features/admin/operations";
import { RecordSelect } from "@/features/admin/record-select";
import type { AdminContext } from "@/features/admin/use-admin-context";
import { useT } from "@/i18n/i18n-provider";

// One form is mounted at a time: a disclosure per operation cost about 7 ms each to mount.
export function OperationList({
  ops,
  ctx,
  initial,
}: {
  ops: readonly Operation[];
  ctx: AdminContext;
  initial?: Readonly<Record<string, string>>;
}) {
  const t = useT();
  const [selected, setSelected] = useState("");
  const op = ops.find((candidate) => candidate.id === selected);
  return (
    <Stack gap={5}>
      <RecordSelect
        label={t("admin.op.choose")}
        options={ops.map((candidate) => ({
          value: candidate.id,
          label: operationTitle(candidate),
        }))}
        value={selected}
        onChange={setSelected}
      />
      {op !== undefined && (
        <OperationForm
          key={op.id}
          op={op}
          ctx={ctx}
          {...(initial === undefined ? {} : { initial })}
        />
      )}
    </Stack>
  );
}
