import { Button } from "@slotted/react/button";
import { toast } from "@slotted/react/toast";

const undoMs = 10000;

// One notice at a time: only the last change can be undone.
const id = "contribution-undo";

// A notice with the way back. It leaves by itself: the change is also undone by hand.
export function showUndo(title: string, label: string, onUndo: () => void) {
  toast.show({
    id,
    tone: "secondary",
    title,
    duration: undoMs,
    actions: (
      <Button
        size="sm"
        variant="outline"
        tone="secondary"
        onClick={() => {
          toast.dismiss(id);
          onUndo();
        }}
      >
        {label}
      </Button>
    ),
  });
}
