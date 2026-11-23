import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@slotted/react/dialog";

import { CompanyReport } from "@/features/instruments";
import { useT } from "@/i18n/i18n-provider";

interface CompanyReportDialogProps {
  code: string;
  open: boolean;
  onClose: () => void;
}

// The statements of the company of a purchase. Read only: closing the dialog changes nothing in
// the plan.
export function CompanyReportDialog({
  code,
  open,
  onClose,
}: CompanyReportDialogProps) {
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
          <DialogTitle>
            {t("contributionPlan.companyReport.title", { name: code })}
          </DialogTitle>
          <DialogClose />
        </DialogHeader>

        <DialogBody>
          <CompanyReport code={code} />
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
