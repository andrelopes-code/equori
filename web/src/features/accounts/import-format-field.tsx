import {
  FieldGroup,
  FieldGroupContent,
  FieldGroupLegend,
} from "@slotted/react/field-group";
import { Inline } from "@slotted/react/inline";
import { Segment, SegmentedControl } from "@slotted/react/segmented-control";

import { useT } from "@/i18n/i18n-provider";

interface ImportFormatFieldProps {
  format: "ofx" | "csv";
  onFormatChange: (next: "ofx" | "csv") => void;
}

export function ImportFormatField({
  format,
  onFormatChange,
}: ImportFormatFieldProps) {
  const t = useT();

  return (
    <FieldGroup required>
      <FieldGroupLegend>{t("importFile.format")}</FieldGroupLegend>
      <FieldGroupContent>
        <Inline>
          <SegmentedControl
            aria-label={t("importFile.format")}
            value={format}
            onValueChange={(next) => {
              if (next === "ofx" || next === "csv") onFormatChange(next);
            }}
          >
            <Segment value="ofx">{t("importFile.ofx")}</Segment>
            <Segment value="csv">{t("importFile.csv")}</Segment>
          </SegmentedControl>
        </Inline>
      </FieldGroupContent>
    </FieldGroup>
  );
}
