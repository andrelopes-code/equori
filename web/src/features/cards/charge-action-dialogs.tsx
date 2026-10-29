import { toast } from "@slotted/react/toast";

import type { ChargeAction } from "@/features/cards/charge-actions";
import { DisputeDialog } from "@/features/cards/dispute-dialog";
import { PlanDrawer } from "@/features/cards/plan-drawer";
import { RefundDialog } from "@/features/cards/refund-dialog";
import { useT } from "@/i18n/i18n-provider";
import { Presence } from "@/ui/presence";

interface ChargeActionDialogsProps {
  action: ChargeAction | null;
  scale: (code: string) => number;
  openReference: string | undefined;
  onEnd: () => void;
}

// The dialog of the command chosen on a purchase line: a refund, a dispute or its plan.
export function ChargeActionDialogs({
  action,
  scale,
  openReference,
  onEnd,
}: ChargeActionDialogsProps) {
  const t = useT();

  return (
    <>
      <Presence value={action?.kind === "refund" ? action : undefined}>
        {(a) => (
          <RefundDialog
            line={a.line}
            scale={scale}
            onCancel={onEnd}
            onDone={() => {
              onEnd();
              toast.show({ tone: "success", title: t("refund.done") });
            }}
          />
        )}
      </Presence>
      <Presence value={action?.kind === "dispute" ? action : undefined}>
        {(a) => (
          <DisputeDialog
            line={a.line}
            open={a.open}
            onCancel={onEnd}
            onDone={() => {
              onEnd();
              toast.show({
                tone: "success",
                title: t(
                  a.open === undefined
                    ? "dispute.openDone"
                    : "dispute.resolveDone",
                ),
              });
            }}
          />
        )}
      </Presence>
      <Presence value={action?.kind === "plan" ? action : undefined}>
        {(a) => (
          <PlanDrawer
            planId={a.planId}
            name={a.line.description}
            openReference={openReference}
            scale={scale}
            onClose={onEnd}
          />
        )}
      </Presence>
    </>
  );
}
