import type { components } from "@/api/schema.gen";
import { EndDialog } from "@/features/planning/schedule-detail/end-dialog";
import { MatchingDialog } from "@/features/planning/schedule-detail/matching-dialog";
import { PauseDialog } from "@/features/planning/schedule-detail/pause-dialog";
import { RemoveTermsDialog } from "@/features/planning/schedule-detail/remove-terms-dialog";
import { RenameDialog } from "@/features/planning/schedule-detail/rename-dialog";
import type { ScheduleMenuChoice } from "@/features/planning/schedule-detail/schedule-menu";
import { StartDialog } from "@/features/planning/schedule-detail/start-dialog";
import { TermsDialog } from "@/features/planning/schedule-detail/terms-dialog";

type Schedule = components["schemas"]["Schedule"];

export type ScheduleDialog =
  "terms" | "reviseTerms" | "removeTerms" | Exclude<ScheduleMenuChoice, "move">;

export interface SuggestedTerms {
  amount: number;
  effectiveFrom: string | undefined;
}

interface ScheduleDialogsProps {
  dialog: ScheduleDialog | null;
  schedule: Schedule;
  name: string;
  suggested: SuggestedTerms | null;
  onClose: () => void;
}

// The dialog the schedule page opened, if any.
export function ScheduleDialogs({
  dialog,
  schedule: s,
  name,
  suggested,
  onClose: close,
}: ScheduleDialogsProps) {
  const latest = s.terms.at(-1);

  return (
    <>
      {dialog === "terms" && (
        <TermsDialog
          schedule={s}
          initialAmount={suggested?.amount}
          initialEffectiveFrom={suggested?.effectiveFrom}
          onDone={close}
          onCancel={close}
        />
      )}
      {dialog === "reviseTerms" && latest !== undefined && (
        <TermsDialog
          schedule={s}
          revised={latest}
          onDone={close}
          onCancel={close}
        />
      )}
      {dialog === "removeTerms" && latest !== undefined && (
        <RemoveTermsDialog
          schedule={s}
          effectiveFrom={latest.effective_from}
          onDone={close}
          onCancel={close}
        />
      )}
      {dialog === "rename" && (
        <RenameDialog schedule={s} onDone={close} onCancel={close} />
      )}
      {dialog === "start" && (
        <StartDialog schedule={s} onDone={close} onCancel={close} />
      )}
      {dialog === "matching" && (
        <MatchingDialog schedule={s} onDone={close} onCancel={close} />
      )}
      {dialog === "pause" && (
        <PauseDialog schedule={s} name={name} onDone={close} onCancel={close} />
      )}
      {dialog === "end" && (
        <EndDialog schedule={s} name={name} onDone={close} onCancel={close} />
      )}
    </>
  );
}
