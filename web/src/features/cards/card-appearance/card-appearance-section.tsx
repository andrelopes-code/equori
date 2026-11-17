import { Button } from "@slotted/react/button";
import { Inline } from "@slotted/react/inline";
import {
  Section,
  SectionActions,
  SectionBody,
  SectionDescription,
  SectionHeader,
  SectionHeading,
  SectionTitle,
} from "@slotted/react/section";
import { Stack } from "@slotted/react/stack";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { useApi } from "@/api/api-context";
import type { components } from "@/api/schema.gen";
import { logoIndexQuery, logoOf } from "@/features/accounts";
import { cardsQuery } from "@/features/cards/api";
import { appearanceSummary } from "@/features/cards/card-appearance/appearance-summary";
import { CardAppearanceSummary } from "@/features/cards/card-appearance/card-appearance-summary";
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

// The colour, art and finish of the card on every screen. Closed, the section is one row: the
// card as drawn today and its choices. The editor opens on request, so the billing cycle and the
// limit below stay in view (owner, 2026-11-17).
export function CardAppearanceSection({
  account,
  institution,
}: CardAppearanceSectionProps) {
  const t = useT();
  const cards = useQuery(cardsQuery(useApi(), account.id));
  const logos = useQuery(logoIndexQuery);
  const form = useCardAppearance(account);
  const [open, setOpen] = useState(false);

  const plastic = cards.data?.find((card) => card.active);
  const logo = logoOf(institution?.identifier, logos.data);
  const appearance = useFaceAppearance(account.face, account.color, logo);
  const identity = previewFace(account.name, institution, logo, plastic);
  const preview = { ...identity, virtual: plastic?.virtual === true };

  function handleCancel() {
    form.reset();
    setOpen(false);
  }

  function handleSave() {
    form.save(() => {
      setOpen(false);
    });
  }

  return (
    <Section>
      <SectionHeader>
        <SectionTitle>
          <SectionHeading>{t("card.appearance")}</SectionHeading>
          <SectionDescription>
            {t("card.appearance.description")}
          </SectionDescription>
        </SectionTitle>

        {!open && (
          <SectionActions>
            <Button
              variant="outline"
              onClick={() => {
                setOpen(true);
              }}
            >
              {t("card.appearance.edit")}
            </Button>
          </SectionActions>
        )}
      </SectionHeader>

      <SectionBody>
        {!open && (
          <CardAppearanceSummary
            face={{ ...preview, ...appearance.props }}
            summary={appearanceSummary(form.draft, appearance.suggested)}
          />
        )}

        {open && (
          <Stack gap={5}>
            <CardFaceStudio
              value={form.draft}
              onChange={form.setDraft}
              suggested={appearance.suggested}
              preview={preview}
            />

            <Inline justify="end" gap={4}>
              <Button variant="ghost" onClick={handleCancel}>
                {t("card.appearance.cancel")}
              </Button>
              <Button
                disabled={!form.changed}
                loading={form.saving}
                onClick={handleSave}
              >
                {t("card.appearance.save")}
              </Button>
            </Inline>
          </Stack>
        )}
      </SectionBody>
    </Section>
  );
}
