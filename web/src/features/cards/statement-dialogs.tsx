import { toast } from "@slotted/react/toast";

import type { components } from "@/api/schema.gen";
import { FactsDialog } from "@/features/cards/facts-dialog";
import { FinanceDialog } from "@/features/cards/finance-dialog";
import { PayDialog } from "@/features/cards/pay-dialog";
import { ReconcileDialog } from "@/features/cards/reconcile-dialog";
import type { StatementDialog } from "@/features/cards/statement-header";
import { useT } from "@/i18n/i18n-provider";
import { Presence } from "@/ui/presence";

type Statement = components["schemas"]["StatementDetail"];

interface StatementDialogsProps {
  statement: Statement | undefined;
  dialog: StatementDialog | null;
  scale: (code: string) => number;
  onClose: () => void;
  onDialog: (dialog: StatementDialog) => void;
}

// The dialogs the statement's header opens, each closing with its confirmation.
export function StatementDialogs({
  statement: s,
  dialog,
  scale,
  onClose,
  onDialog,
}: StatementDialogsProps) {
  const t = useT();

  function done(title: string) {
    onClose();
    toast.show({ tone: "success", title });
  }

  return (
    <>
      <Presence
        value={s !== undefined && dialog === "pay" ? dialog : undefined}
      >
        {() =>
          s === undefined ? null : (
            <PayDialog
              statement={s}
              scale={scale}
              onCancel={onClose}
              onDone={() => {
                done(t("pay.done"));
              }}
            />
          )
        }
      </Presence>
      <Presence
        value={s !== undefined && dialog === "finance" ? dialog : undefined}
      >
        {() =>
          s === undefined ? null : (
            <FinanceDialog
              statement={s}
              scale={scale}
              onCancel={onClose}
              onDone={() => {
                done(t("finance.done"));
              }}
            />
          )
        }
      </Presence>
      <Presence
        value={s !== undefined && dialog === "reconcile" ? dialog : undefined}
      >
        {() =>
          s === undefined ? null : (
            <ReconcileDialog
              statement={s}
              scale={scale}
              onCancel={onClose}
              onFacts={() => {
                onDialog("facts");
              }}
              onDone={() => {
                done(t("reconcileStatement.done"));
              }}
            />
          )
        }
      </Presence>
      <Presence
        value={s !== undefined && dialog === "facts" ? dialog : undefined}
      >
        {() =>
          s === undefined ? null : (
            <FactsDialog
              statement={s}
              scale={scale}
              onCancel={onClose}
              onDone={() => {
                done(t("facts.done"));
              }}
            />
          )
        }
      </Presence>
    </>
  );
}
