import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@slotted/react/dialog";

import type { components } from "@/api/schema.gen";
import { IndexerComparison } from "@/features/calculators";
import { useT } from "@/i18n/i18n-provider";

type Money = components["schemas"]["Money"];

interface CompareIndexersDialogProps {
  // The cost of the row: the initial amount of the comparison.
  amount: Money;
  open: boolean;
  onClose: () => void;
}

// The comparison of indexers for the amount of a purchase. The inputs live in the comparison's
// state: the list renders the dialog only while it is open, so closing drops them, and nothing
// reaches the plan or its split.
export function CompareIndexersDialog({
  amount,
  open,
  onClose,
}: CompareIndexersDialogProps) {
  const t = useT();

  return (
    <Dialog
      open={open}
      size="full"
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t("contributionPlan.compareIndexers.title")}
          </DialogTitle>
          <DialogDescription>
            {t("calc.indexer-comparison.question")}
          </DialogDescription>
          <DialogClose />
        </DialogHeader>

        <DialogBody>
          <IndexerComparison
            amount={amount.amount}
            currency={amount.currency}
            embedded
          />
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
