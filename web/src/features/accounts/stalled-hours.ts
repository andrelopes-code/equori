import type { components } from "@/api/schema.gen";

type Connection = components["schemas"]["Connection"];

const msPerHour = 3_600_000;

export function stalledHours(
  connection: Pick<Connection, "last_item_update_at" | "last_synced_at">,
  now: Date,
): number {
  const instants = [connection.last_item_update_at, connection.last_synced_at]
    .filter((iso) => iso !== undefined)
    .map((iso) => new Date(iso).getTime());

  if (instants.length === 0) {
    return 0;
  }

  return Math.floor((now.getTime() - Math.min(...instants)) / msPerHour);
}
