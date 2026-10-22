import { use } from "react";
import { createPortal } from "react-dom";
import type { ReactNode } from "react";

import { AccountsHeaderSlots } from "@/features/accounts/accounts-header-slots";

// Writes into one slot of the accounts header from the page below it.
export function HeaderSlot({
  slot,
  children,
}: {
  slot: "subheading" | "actions";
  children: ReactNode;
}) {
  const target = use(AccountsHeaderSlots)[slot];
  return target === null ? null : createPortal(children, target);
}
