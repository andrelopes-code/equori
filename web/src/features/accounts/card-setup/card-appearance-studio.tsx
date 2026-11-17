import { useDraftInstitution } from "@/features/accounts/account-form/use-draft-institution";
import { appearancePreview } from "@/features/accounts/card-setup/card-appearance-preview";
import type { AccountDraft } from "@/features/accounts/model/account-draft";
import { useT } from "@/i18n/i18n-provider";
import { useLogoTraits } from "@/ui/card-face/use-logo-traits";
import { CardFaceStudio } from "@/ui/card-face/studio/card-face-studio";
import {
  suggestedColor,
  type FaceDraft,
} from "@/ui/card-face/studio/face-draft";

interface CardAppearanceStudioProps {
  draft: AccountDraft;
  onChange: (face: FaceDraft) => void;
}

// The studio over the draft's face, previewed with the account's name, institution and first
// plastic card.
export function CardAppearanceStudio({
  draft,
  onChange,
}: CardAppearanceStudioProps) {
  const t = useT();
  const { chosen, logo } = useDraftInstitution(draft);
  const traits = useLogoTraits(logo);

  const name = draft.name.trim();
  const suggested = suggestedColor(draft.color ?? undefined, traits?.color);
  const preview = appearancePreview({
    title: name === "" ? t("kind.title.credit_card") : name,
    logo,
    institutionName: chosen?.name,
    row: draft.card.cards[0],
  });

  return (
    <CardFaceStudio
      value={draft.card.face}
      onChange={onChange}
      suggested={suggested}
      preview={preview}
    />
  );
}
