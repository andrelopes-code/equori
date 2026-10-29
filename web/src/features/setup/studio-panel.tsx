import { Tab, TabList, TabPanel, Tabs } from "@slotted/react/tabs";

import { AppearanceColour } from "@/features/setup/appearance-colour";
import { AppearanceEffects } from "@/features/setup/appearance-effects";
import { AppearanceShape } from "@/features/setup/appearance-shape";
import { AppearanceSurfaces } from "@/features/setup/appearance-surfaces";
import { AppearanceText } from "@/features/setup/appearance-text";
import styles from "@/features/setup/appearance-studio.module.css";
import { ThemeGallery } from "@/features/setup/theme-gallery";
import type { ThemeLibrary } from "@/features/setup/use-theme-library";
import { useT } from "@/i18n/i18n-provider";

export interface StudioPanelProps {
  library: ThemeLibrary;
}

const tabs = [
  "themes",
  "colour",
  "surfaces",
  "shape",
  "text",
  "effects",
] as const;

// Families read: tabs. The controls of the studio, one concern per tab, at the panel's width.
export function StudioPanel({ library }: StudioPanelProps) {
  const t = useT();

  return (
    <Tabs defaultValue="themes" size="sm" className={styles.panel}>
      <TabList aria-label={t("studio.tabs")} className={styles.tabs}>
        {tabs.map((tab) => (
          <Tab key={tab} value={tab}>
            {t(`studio.tab.${tab}`)}
          </Tab>
        ))}
      </TabList>

      <TabPanel value="themes" className={styles.tabPanel}>
        <ThemeGallery
          saved={library.saved}
          active={library.active}
          onChoose={library.choose}
        />
      </TabPanel>
      <TabPanel value="colour" className={styles.tabPanel}>
        <AppearanceColour />
      </TabPanel>
      <TabPanel value="surfaces" className={styles.tabPanel}>
        <AppearanceSurfaces />
      </TabPanel>
      <TabPanel value="shape" className={styles.tabPanel}>
        <AppearanceShape />
      </TabPanel>
      <TabPanel value="text" className={styles.tabPanel}>
        <AppearanceText />
      </TabPanel>
      <TabPanel value="effects" className={styles.tabPanel}>
        <AppearanceEffects />
      </TabPanel>
    </Tabs>
  );
}
