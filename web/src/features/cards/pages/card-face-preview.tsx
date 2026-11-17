import { Page, PageBody } from "@slotted/react/page";
import { Stack } from "@slotted/react/stack";
import { useState } from "react";

import { PreviewSection } from "@/features/cards/pages/card-face-preview/preview-section";
import { PreviewStudio } from "@/features/cards/pages/card-face-preview/preview-studio";
import { PreviewTickets } from "@/features/cards/pages/card-face-preview/preview-tickets";
import {
  sections,
  stackFaces,
} from "@/features/cards/pages/card-face-preview/preview-data";
import styles from "@/features/cards/pages/card-face-preview.module.css";
import { useT } from "@/i18n/i18n-provider";
import { CardFace } from "@/ui/card-face/card-face";
import { CardFaceStack } from "@/ui/card-face/card-face-stack";

// Development only (router.tsx): the card face in each of its cases, with fixed data and no API
// call, to check art, colour, network, state, brand, width and the stack.
export function CardFacePreview() {
  const t = useT();
  const [selected, setSelected] = useState(stackFaces[0]?.id ?? "");

  return (
    <Page width="full">
      <PageBody>
        <Stack gap={8}>
          {sections.map((section) => (
            <PreviewSection key={section.title} title={section.title}>
              <div className={styles.grid}>
                {section.items.map(({ key, width, face }) => (
                  <div key={key} className={styles[width]}>
                    <CardFace {...face} />
                  </div>
                ))}
              </div>
            </PreviewSection>
          ))}

          <PreviewSection title="cardFacePreview.stack">
            <div className={styles.w380}>
              <CardFaceStack
                faces={stackFaces}
                selected={selected}
                onSelect={setSelected}
                label={t("cardFace.stack")}
              />
            </div>
          </PreviewSection>

          <PreviewTickets />

          <PreviewSection title="cardFacePreview.studio">
            <PreviewStudio />
          </PreviewSection>
        </Stack>
      </PageBody>
    </Page>
  );
}
