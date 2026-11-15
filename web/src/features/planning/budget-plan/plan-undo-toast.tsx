import { Button } from "@slotted/react/button";
import { toast } from "@slotted/react/toast";

// A toast of eight seconds whose button reverts the change it reports.
export function showUndoToast(
  title: string,
  label: string,
  onUndo: () => void,
) {
  const id = `plan-undo-${String(Date.now())}`;
  toast.show({
    id,
    tone: "secondary",
    title,
    duration: 8000,
    actions: (
      <Button
        size="sm"
        variant="ghost"
        onClick={() => {
          onUndo();
          toast.dismiss(id);
        }}
      >
        {label}
      </Button>
    ),
  });
}
