import type { Statement } from "@/features/cards/statement-groups";

const tones = {
  open: "neutral",
  closed: "info",
  partially_paid: "warning",
  overdue: "danger",
  paid: "success",
  financed: "neutral",
} as const satisfies Record<
  Statement["status"],
  "neutral" | "info" | "warning" | "danger" | "success"
>;

export function statusTone(
  status: Statement["status"],
): "neutral" | "info" | "warning" | "danger" | "success" {
  return tones[status];
}
