export type Operation = "expense" | "income" | "transfer-out" | "transfer-in";

export function operationOf(
  kind: "expense" | "income" | "transfer",
  direction: "out" | "in",
): Operation {
  if (kind === "transfer")
    return direction === "out" ? "transfer-out" : "transfer-in";

  return kind;
}
