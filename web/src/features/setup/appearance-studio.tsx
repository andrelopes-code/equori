import { Page, PageBody } from "@slotted/react/page";

import styles from "@/features/setup/appearance-studio.module.css";
import { StudioCanvas } from "@/features/setup/studio-canvas";
import { StudioHeader } from "@/features/setup/studio-header";
import { StudioPanel } from "@/features/setup/studio-panel";
import { useThemeLibrary } from "@/features/setup/use-theme-library";

// The appearance studio: the controls at the start edge, the application drawn beside them
// (docs/specs/2026-10-29-appearance-studio-design.md, A7).
export function AppearanceStudio() {
  const library = useThemeLibrary();

  return (
    <Page width="full">
      <StudioHeader library={library} />
      <PageBody>
        <div className={styles.workspace}>
          <StudioPanel library={library} />
          <StudioCanvas />
        </div>
      </PageBody>
    </Page>
  );
}
