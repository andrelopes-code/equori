import { Button } from "@slotted/react/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@slotted/react/field";
import { Inline } from "@slotted/react/inline";
import { TextField } from "@slotted/react/text-field";
import { useState } from "react";

import { useT } from "@/i18n/i18n-provider";
import { customTypeface, useTypeface } from "@/theme/typeface";

// Any face installed on the reader's device, by its family name. A name the device does not hold
// leaves the system face in force.
export function CustomTypefaceField() {
  const t = useT();
  const [typeface, setTypeface] = useTypeface();
  const [name, setName] = useState(
    typeface.startsWith("custom:") ? typeface.slice("custom:".length) : "",
  );
  const [invalid, setInvalid] = useState(false);
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const next = customTypeface(name);
        setInvalid(next === null);
        if (next !== null) setTypeface(next);
      }}
    >
      <Field invalid={invalid}>
        <FieldLabel>{t("settings.typeface.custom")}</FieldLabel>
        <Inline gap={3} align="center">
          <TextField
            name="typeface"
            value={name}
            maxLength={64}
            placeholder={t("settings.typeface.customPlaceholder")}
            onChange={(event) => {
              setName(event.target.value);
            }}
          />
          <Button type="submit" variant="outline" tone="secondary">
            {t("settings.typeface.use")}
          </Button>
        </Inline>
        <FieldDescription>
          {t("settings.typeface.customDescription")}
        </FieldDescription>
        {invalid && <FieldError>{t("settings.typeface.invalid")}</FieldError>}
      </Field>
    </form>
  );
}
