import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@slotted/react/field";
import { TextField } from "@slotted/react/text-field";
import { useState } from "react";

import { useT } from "@/i18n/i18n-provider";
import styles from "@/ui/card-face/studio/color-controls.module.css";
import { normalizeHex } from "@/ui/card-face/studio/oklch";

interface HexFieldProps {
  color: string;
  onColor: (hex: string) => void;
}

export function HexField({ color, onColor }: HexFieldProps) {
  const t = useT();
  const [text, setText] = useState(color.toUpperCase());
  const [known, setKnown] = useState(color);
  const [invalid, setInvalid] = useState(false);

  if (color !== known) {
    setKnown(color);
    setText(color.toUpperCase());
    setInvalid(false);
  }

  function handleChange(value: string) {
    const hex = normalizeHex(value);

    setText(value);
    setInvalid(hex === null);

    if (hex !== null) {
      onColor(hex);
    }
  }

  return (
    <div className={styles.hex}>
      <Field invalid={invalid} necessity="none">
        <FieldLabel>{t("cardFace.studio.hex")}</FieldLabel>
        <TextField
          value={text}
          maxLength={7}
          spellCheck={false}
          autoComplete="off"
          onChange={(event) => {
            handleChange(event.target.value);
          }}
        />
        {invalid && <FieldError>{t("cardFace.studio.hexError")}</FieldError>}
        {!invalid && (
          <FieldDescription>{t("cardFace.studio.hexHint")}</FieldDescription>
        )}
      </Field>
    </div>
  );
}
