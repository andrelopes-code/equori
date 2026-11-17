import { useState } from "react";

import { studioFace } from "@/features/cards/pages/card-face-preview/preview-data";
import { CardFaceStudio } from "@/ui/card-face/studio/card-face-studio";
import { emptyFace } from "@/ui/card-face/studio/face-draft";

const suggested = "#820ad1";

export function PreviewStudio() {
  const [draft, setDraft] = useState(emptyFace);

  return (
    <CardFaceStudio
      value={draft}
      onChange={setDraft}
      suggested={suggested}
      preview={studioFace}
    />
  );
}
