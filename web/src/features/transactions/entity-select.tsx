import { EntityPicker, rememberRecent } from "@slotted/react/entity-picker";
import type { Entity } from "@slotted/react/entity-picker";
import { useState } from "react";

import {
  loadRecent,
  saveRecent,
} from "@/features/transactions/recent-entities";

export function EntitySelect({
  label,
  kind,
  entities,
  value,
  onChange,
  onCreate,
  defaultOpen,
}: {
  label: string;
  kind: string;
  entities: Entity[];
  value: string;
  onChange: (id: string, entity: Entity | undefined) => void;
  onCreate?: (query: string) => Entity;
  defaultOpen?: boolean;
}) {
  const [recentIds, setRecentIds] = useState(() => loadRecent(kind));
  const byId = new Map(entities.map((e) => [e.id, e]));
  const recent = recentIds.flatMap((id) => byId.get(id) ?? []);
  return (
    <EntityPicker
      aria-label={label}
      items={entities}
      entities={entities}
      recent={recent}
      value={value === "" ? null : value}
      {...(defaultOpen === true ? { defaultOpen: true, portal: false } : {})}
      {...(onCreate === undefined ? {} : { onCreate })}
      onValueChange={(next, request) => {
        const id = typeof next === "string" ? next : "";
        const entity = request.entities[0];
        if (id !== "" && entity !== undefined && byId.has(id)) {
          const ids = rememberRecent(recent, entity).map((e) => e.id);
          setRecentIds(saveRecent(kind, ids));
        }
        onChange(id, entity);
      }}
    />
  );
}
