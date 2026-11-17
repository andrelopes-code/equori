import { useId } from "react";

import { useT } from "@/i18n/i18n-provider";
import type { FaceDraft } from "@/ui/card-face/studio/face-draft";
import { FinishDrawing } from "@/ui/card-face/studio/finish-drawing";
import { FinishGroup } from "@/ui/card-face/studio/finish-group";
import styles from "@/ui/card-face/studio/finish-options.module.css";
import { OptionTile } from "@/ui/card-face/studio/option-tile";
import {
  brandOptions,
  chipOptions,
  orientationOptions,
} from "@/ui/card-face/studio/studio-labels";

interface FinishOptionsProps {
  value: FaceDraft;
  onPatch: (patch: Partial<FaceDraft>) => void;
}

export function FinishOptions({ value, onPatch }: FinishOptionsProps) {
  const t = useT();
  const chipGroup = useId();
  const orientationGroup = useId();
  const brandGroup = useId();

  return (
    <div className={styles.finish}>
      <FinishGroup label={t("cardFace.studio.chip")}>
        {chipOptions.map(({ key, label }) => (
          <OptionTile
            key={key}
            variant="vis"
            group={chipGroup}
            label={t(label)}
            checked={(value.chip ?? "gold") === key}
            onSelect={() => {
              onPatch({ chip: key });
            }}
          >
            <FinishDrawing kind={key} />
          </OptionTile>
        ))}
      </FinishGroup>

      <FinishGroup label={t("cardFace.studio.orientation")}>
        {orientationOptions.map(({ key, label }) => (
          <OptionTile
            key={key}
            variant="vis"
            group={orientationGroup}
            label={t(label)}
            checked={(value.orientation ?? "horizontal") === key}
            onSelect={() => {
              onPatch({ orientation: key });
            }}
          >
            <FinishDrawing kind={key} />
          </OptionTile>
        ))}
      </FinishGroup>

      <FinishGroup label={t("cardFace.studio.brand")}>
        {brandOptions.map(({ key, label }) => (
          <OptionTile
            key={key}
            variant="vis"
            group={brandGroup}
            label={t(label)}
            checked={(value.brand ?? "auto") === key}
            onSelect={() => {
              onPatch({ brand: key });
            }}
          >
            <FinishDrawing kind={key} />
          </OptionTile>
        ))}
      </FinishGroup>
    </div>
  );
}
