import styles from "@/features/cards/plastic-cards-tab/card-dialog-preview.module.css";
import type { FaceBase } from "@/features/cards/plastic-cards-tab/plastic-card-faces";
import type { CardForm } from "@/features/cards/plastic-cards-tab/use-card-form";
import { CardFace } from "@/ui/card-face/card-face";

interface CardDialogPreviewProps {
  base: FaceBase;
  form: CardForm;
}

// The account's face with the values the dialog holds.
export function CardDialogPreview({ base, form }: CardDialogPreviewProps) {
  return (
    <div className={styles.stage}>
      <div className={styles.face}>
        <CardFace
          {...base}
          holder={form.holder}
          lastFour={form.lastFour}
          virtual={form.virtual}
          {...(form.network !== "" && { network: form.network })}
        />
      </div>
    </div>
  );
}
