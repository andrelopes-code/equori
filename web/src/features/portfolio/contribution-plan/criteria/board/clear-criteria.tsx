import { Button } from "@slotted/react/button";
import { useState } from "react";

import { useT } from "@/i18n/i18n-provider";
import { ConfirmDialog } from "@/ui/dialogs/confirm-dialog";

interface ClearCriteriaProps {
  // The name of the group.
  name: string;
  onClear: () => void;
}

// The way back to the typed ideals: it drops every criterion of the group, so it asks first.
export function ClearCriteria({ name, onClear }: ClearCriteriaProps) {
  const t = useT();
  const [asking, setAsking] = useState(false);

  return (
    <>
      <Button
        size="sm"
        variant="ghost"
        tone="secondary"
        onClick={() => {
          setAsking(true);
        }}
      >
        {t("contributionPlan.criteria.clear")}
      </Button>

      {asking && (
        <ConfirmDialog
          title={t("contributionPlan.criteria.clearTitle", { name })}
          description={t("contributionPlan.criteria.clearBody")}
          confirmLabel={t("contributionPlan.criteria.clear")}
          cancelLabel={t("contributionPlan.criteria.clearKeep")}
          tone="warning"
          onConfirm={() => {
            setAsking(false);
            onClear();
          }}
          onCancel={() => {
            setAsking(false);
          }}
        />
      )}
    </>
  );
}
