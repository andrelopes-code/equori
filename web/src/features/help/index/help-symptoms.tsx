import {
  Section,
  SectionBody,
  SectionDescription,
  SectionHeader,
  SectionHeading,
  SectionTitle,
} from "@slotted/react/section";

import type { HelpSection } from "@/features/help/model/parse-help-page";
import { HelpRow } from "@/features/help/row/help-row";
import styles from "@/features/help/styles/help.module.css";
import { useT } from "@/i18n/i18n-provider";

interface HelpSymptomsProps {
  symptoms: readonly HelpSection[];
}

// Each symptom as the screen shows it, leading to its cause and its steps (help spec, HP8).
export function HelpSymptoms({ symptoms }: HelpSymptomsProps) {
  const t = useT();

  return (
    <Section size="lg">
      <SectionHeader>
        <SectionTitle>
          <SectionHeading>{t("help.symptoms.title")}</SectionHeading>
          <SectionDescription>
            {t("help.symptoms.description")}
          </SectionDescription>
        </SectionTitle>
      </SectionHeader>

      <SectionBody>
        <ul className={styles.symptoms} role="list" data-part="symptoms">
          {symptoms.map((symptom) => (
            <HelpRow
              key={symptom.id}
              page="troubleshooting"
              hash={symptom.id}
              title={symptom.title}
            />
          ))}
        </ul>
      </SectionBody>
    </Section>
  );
}
