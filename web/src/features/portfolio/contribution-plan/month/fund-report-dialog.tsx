import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@slotted/react/dialog";

import { FundReport } from "@/features/instruments";
import { useT } from "@/i18n/i18n-provider";

interface FundReportDialogProps {
  code: string;
  // The currency of the row's cost: the report compares its price against it.
  quote: string;
  open: boolean;
  onClose: () => void;
}

// The fund report of a purchase. Read only: closing the dialog changes nothing in the plan.
export function FundReportDialog({
  code,
  quote,
  open,
  onClose,
}: FundReportDialogProps) {
  const t = useT();

  return (
    <Dialog
      open={open}
      size="xl"
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("contributionPlan.fundReport.title")}</DialogTitle>
          <DialogClose />
        </DialogHeader>

        <DialogBody>
          <FundReport code={code} quote={quote} />
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
