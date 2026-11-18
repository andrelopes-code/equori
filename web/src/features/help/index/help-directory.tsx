import {
  Section,
  SectionBody,
  SectionDescription,
  SectionHeader,
  SectionHeading,
  SectionTitle,
} from "@slotted/react/section";

import { HelpArea } from "@/features/help/index/help-area";
import { helpAreas } from "@/features/help/model/help-guides";
import type { HelpLibrary } from "@/features/help/model/help-library";
import styles from "@/features/help/styles/help.module.css";
import { useT } from "@/i18n/i18n-provider";

interface HelpDirectoryProps {
  library: HelpLibrary | undefined;
}

// The help pages by area of the app, in two columns on a wide page (help spec, HP1).
export function HelpDirectory({ library }: HelpDirectoryProps) {
  const t = useT();

  return (
    <Section size="lg">
      <SectionHeader>
        <SectionTitle>
          <SectionHeading>{t("help.areas.title")}</SectionHeading>
          <SectionDescription>{t("help.areas.description")}</SectionDescription>
        </SectionTitle>
      </SectionHeader>

      <SectionBody>
        <div className={styles.areas}>
          {helpAreas.map((area) => (
            <HelpArea key={area} area={area} library={library} />
          ))}
        </div>
      </SectionBody>
    </Section>
  );
}
