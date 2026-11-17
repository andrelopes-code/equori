import { Button } from "@slotted/react/button";
import { Inline } from "@slotted/react/inline";
import {
  Section,
  SectionBody,
  SectionDescription,
  SectionHeader,
  SectionHeading,
  SectionTitle,
} from "@slotted/react/section";
import { Stack } from "@slotted/react/stack";
import { useQuery } from "@tanstack/react-query";

import { useApi } from "@/api/api-context";
import type { components } from "@/api/schema.gen";
import { logoIndexQuery, logoOf } from "@/features/accounts";
import { cardsQuery } from "@/features/cards/api";
import { previewFace } from "@/features/cards/card-appearance/preview-face";
import { useCardAppearance } from "@/features/cards/card-appearance/use-card-appearance";
import { useT } from "@/i18n/i18n-provider";
import { CardFaceStudio } from "@/ui/card-face/studio/card-face-studio";
import { useFaceAppearance } from "@/ui/card-face/use-face-appearance";

type Account = components["schemas"]["Account"];
type Institution = components["schemas"]["Institution"];

interface CardAppearanceSectionProps {
  account: Account;
  institution: Institution | undefined;
}

// The colour, art and finish of the card on every screen, edited on the face it draws with the
// holder, digits and network of its first active plastic card.
export function CardAppearanceSection({
  account,
  institution,
}: CardAppearanceSectionProps) {
  const t = useT();
  const cards = useQuery(cardsQuery(useApi(), account.id));
  const logos = useQuery(logoIndexQuery);
  const form = useCardAppearance(account);

  const plastic = cards.data?.find((card) => card.active);
  const logo = logoOf(institution?.identifier, logos.data);
  const appearance = useFaceAppearance(account.face, account.color, logo);
  const identity = previewFace(account.name, institution, logo, plastic);

  return (
    <Section>
      <SectionHeader>
        <SectionTitle>
          <SectionHeading>{t("card.appearance")}</SectionHeading>
          <SectionDescription>
            {t("card.appearance.description")}
          </SectionDescription>
        </SectionTitle>
      </SectionHeader>

      <SectionBody>
        <Stack gap={5}>
          <CardFaceStudio
            value={form.draft}
            onChange={form.setDraft}
            suggested={appearance.suggested}
            preview={{ ...identity, virtual: plastic?.virtual === true }}
          />

          <Inline justify="end">
            <Button
              disabled={!form.changed}
              loading={form.saving}
              onClick={form.save}
            >
              {t("card.appearance.save")}
            </Button>
          </Inline>
        </Stack>
      </SectionBody>
    </Section>
  );
}
