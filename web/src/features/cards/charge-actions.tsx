import { MenuItem } from "@slotted/react/menu";
import { useQuery } from "@tanstack/react-query";

import { useApi } from "@/api/api-context";
import type { components } from "@/api/schema.gen";
import { disputesQuery } from "@/features/cards/api";
import { useT } from "@/i18n/i18n-provider";

type StatementPosting = components["schemas"]["StatementPosting"];
type Dispute = components["schemas"]["Dispute"];

export type ChargeAction =
  | { kind: "refund"; line: StatementPosting }
  | { kind: "dispute"; line: StatementPosting; open: Dispute | undefined }
  | { kind: "plan"; line: StatementPosting; planId: string };

// The commands of a purchase line: a refund, a dispute opened or resolved, and its plan when it
// is an installment. An installment line holds one installment, not the purchase, so its plan's
// cancellation stands in for a refund (M07).
export function ChargeActions({
  line,
  onAction,
}: {
  line: StatementPosting;
  onAction: (action: ChargeAction) => void;
}) {
  const t = useT();
  const disputes = useQuery(disputesQuery(useApi(), line.transaction_id));
  const open = disputes.data?.items.find((d) => d.resolved_on === undefined);
  const planId = line.installment?.plan_id;
  return (
    <>
      {planId !== undefined && (
        <MenuItem
          onSelect={() => {
            onAction({ kind: "plan", line, planId });
          }}
        >
          {t("plan.open")}
        </MenuItem>
      )}
      {planId === undefined && (
        <MenuItem
          disabled={open !== undefined}
          onSelect={() => {
            onAction({ kind: "refund", line });
          }}
        >
          {t("refund.action")}
        </MenuItem>
      )}
      <MenuItem
        disabled={disputes.isPending}
        onSelect={() => {
          onAction({ kind: "dispute", line, open });
        }}
      >
        {t(open === undefined ? "dispute.open" : "dispute.resolve")}
      </MenuItem>
    </>
  );
}
