import { toast } from "@slotted/react/toast";
import { useState } from "react";

import { errorText } from "@/api/problem";
import type { components } from "@/api/schema.gen";
import { useSetCardFace } from "@/features/cards/api";
import { sameFace } from "@/features/cards/card-appearance/same-face";
import { useT } from "@/i18n/i18n-provider";
import { faceBody, faceOf } from "@/ui/card-face/studio/face-draft";
import type { FaceDraft } from "@/ui/card-face/studio/face-draft";

type Account = components["schemas"]["Account"];

interface CardAppearance {
  draft: FaceDraft;
  changed: boolean;
  saving: boolean;
  setDraft: (draft: FaceDraft) => void;
  // Drops the edits: the draft is the stored face again.
  reset: () => void;
  save: (onSaved: () => void) => void;
}

// The draft of a card's appearance and its save. The draft belongs to the stored face it was
// edited from: when the stored face changes, the draft is the new stored face.
export function useCardAppearance(account: Account): CardAppearance {
  const t = useT();
  const setFace = useSetCardFace();
  const stored = faceOf(account);
  const key = JSON.stringify(stored);
  const [edit, setEdit] = useState<{ key: string; face: FaceDraft }>();
  const draft = edit?.key === key ? edit.face : stored;

  function save(onSaved: () => void) {
    setFace
      .mutateAsync({ id: account.id, face: faceBody(draft) })
      .then(() => {
        toast.show({ tone: "success", title: t("card.appearance.saved") });
        onSaved();
      })
      .catch((caught: unknown) => {
        toast.show({ tone: "danger", title: errorText(caught, t) });
      });
  }

  return {
    draft,
    changed: !sameFace(draft, stored),
    saving: setFace.isPending,
    setDraft: (face) => {
      setEdit({ key, face });
    },
    reset: () => {
      setEdit(undefined);
    },
    save,
  };
}
