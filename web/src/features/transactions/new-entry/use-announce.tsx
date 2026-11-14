import { Button } from "@slotted/react/button";
import { toast } from "@slotted/react/toast";
import { useNavigate } from "@tanstack/react-router";

import { useT } from "@/i18n/i18n-provider";

// Shows the success toast of a saved entry, with an action that opens it.
export function useAnnounce() {
  const t = useT();
  const navigate = useNavigate();

  return (id: string, title: string) => {
    toast.show({
      tone: "success",
      title,
      actions: (
        <Button
          size="sm"
          variant="ghost"
          tone="secondary"
          onClick={() => {
            void navigate({ to: "/transactions/$id", params: { id } });
          }}
        >
          {t("entry.view")}
        </Button>
      ),
    });
  };
}
