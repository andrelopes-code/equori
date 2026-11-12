import type { Entity } from "@slotted/core/entity-picker";
import { EntityPicker } from "@slotted/react/entity-picker";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { useApi } from "@/api/api-context";
import { instrumentsQuery } from "@/features/setup";
import { useT } from "@/i18n/i18n-provider";

interface InstrumentFieldProps {
  // The instrument code chosen.
  value: string | null;
  // The codes the brokerage holds, for a sale; null offers every investment of the catalog.
  heldCodes: readonly string[] | null;
  invalid: boolean;
  onChange: (code: string | null) => void;
}

// The investment of a trade or an income, searchable by name and by code.
export function InstrumentField({
  value,
  heldCodes,
  invalid,
  onChange,
}: InstrumentFieldProps) {
  const t = useT();
  const instruments = useQuery(instrumentsQuery(useApi()));
  const items = useMemo(
    (): Entity[] =>
      (instruments.data?.items ?? [])
        .filter(
          (i) =>
            i.type !== "currency" &&
            (heldCodes === null || heldCodes.includes(i.code)),
        )
        .map((i) => ({ id: i.code, label: i.name, description: i.code })),
    [instruments.data, heldCodes],
  );

  return (
    <EntityPicker
      items={items}
      value={value}
      openOn="focus"
      width="anchor"
      media="none"
      placeholder={t("trade.investment")}
      invalid={invalid}
      onValueChange={(next) => {
        onChange(typeof next === "string" ? next : null);
      }}
    />
  );
}
