import { toast } from "@slotted/react/toast";
import { useNavigate } from "@tanstack/react-router";

import { useT } from "@/i18n/i18n-provider";

// What a saved correction does: it says so and returns to the transaction.
export function useCorrectionDone(id: string): () => void {
  const t = useT();
  const navigate = useNavigate();

  return () => {
    toast.show({ tone: "success", title: t("correct.done") });
    void navigate({ to: "/transactions/$id", params: { id } });
  };
}
