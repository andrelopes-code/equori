import { Switch } from "@slotted/react/switch";
import { useState } from "react";

import { CardAppearanceStudio } from "@/features/accounts/card-setup/card-appearance-studio";
import type { AccountDraft } from "@/features/accounts/model/account-draft";
import { useT } from "@/i18n/i18n-provider";
import { faceIsEmpty } from "@/ui/card-face/studio/face-draft";
import type { FaceDraft } from "@/ui/card-face/studio/face-draft";
import { FormSection } from "@/ui/form-layout/form-section";

interface CardAppearanceSectionProps {
  draft: AccountDraft;
  onChange: (face: FaceDraft) => void;
}

// F9: the appearance is a rare answer, opened by a choice. Closing it clears nothing; the
// face is sent only when a value is set.
export function CardAppearanceSection({
  draft,
  onChange,
}: CardAppearanceSectionProps) {
  const t = useT();
  const [open, setOpen] = useState(() => !faceIsEmpty(draft.card.face));

  return (
    <FormSection legend={t("accountForm.cardAppearance")}>
      <Switch
        checked={open}
        onCheckedChange={setOpen}
        description={t("accountForm.cardAppearance.hint")}
      >
        {t("accountForm.cardAppearance.customize")}
      </Switch>

      {open && <CardAppearanceStudio draft={draft} onChange={onChange} />}
    </FormSection>
  );
}
