import { Page, PageBody } from "@slotted/react/page";
import {
  Section,
  SectionBody,
  SectionDescription,
  SectionHeader,
  SectionHeading,
  SectionTitle,
} from "@slotted/react/section";

import styles from "@/features/assistant/preview/answers-preview.module.css";
import { ScenarioCard } from "@/features/assistant/preview/scenario-card";
import { scenarioGroups } from "@/features/assistant/preview/scenario-groups";
import { useT } from "@/i18n/i18n-provider";
import { PageStack } from "@/ui/page-layout/page-stack";

// Development only (router.tsx): every form an assistant answer takes, each beside the question
// that produces it, with fixed data and no API call.
export function AnswersPreview() {
  const t = useT();

  return (
    <Page width="full">
      <PageBody>
        <PageStack>
          {scenarioGroups.map((group) => (
            <Section key={group.title} size="lg">
              <SectionHeader>
                <SectionTitle>
                  <SectionHeading>{t(group.title)}</SectionHeading>
                </SectionTitle>
                <SectionDescription>{t(group.description)}</SectionDescription>
              </SectionHeader>

              <SectionBody>
                <div className={styles.grid}>
                  {group.scenarios.map((scenario) => (
                    <ScenarioCard key={scenario.id} scenario={scenario} />
                  ))}
                </div>
              </SectionBody>
            </Section>
          ))}
        </PageStack>
      </PageBody>
    </Page>
  );
}
