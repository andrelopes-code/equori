import { VisuallyHidden } from "@slotted/react/visually-hidden";

import { useT } from "@/i18n/i18n-provider";
import { useDebounced } from "@/ui/runtime/use-debounced";

interface PlanAnnouncerProps {
  over: boolean;
  // The unassigned figure as the panel writes it.
  figure: string;
}

// Reads the unassigned figure to a screen reader half a second after typing stops.
export function PlanAnnouncer({ over, figure }: PlanAnnouncerProps) {
  const t = useT();
  const announced = useDebounced(
    `${over ? t("plan.over") : t("plan.unassigned")} ${figure}`,
    500,
  );

  return (
    <VisuallyHidden>
      <span aria-live="polite">{announced}</span>
    </VisuallyHidden>
  );
}
