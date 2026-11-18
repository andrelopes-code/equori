import { ButtonLink } from "@slotted/react/button";
import { Icon } from "@slotted/react/icon";
import {
  Section,
  SectionActions,
  SectionBody,
  SectionDescription,
  SectionHeader,
  SectionHeading,
  SectionTitle,
} from "@slotted/react/section";
import { Skeleton } from "@slotted/react/skeleton";
import { Link } from "@tanstack/react-router";

import type { HelpLibraryPage } from "@/features/help/model/help-library";
import { HelpAnchor } from "@/features/help/row/help-anchor";
import styles from "@/features/help/styles/help.module.css";
import { numberFormatter } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { StepGlyph } from "@/ui/navigation/step-glyph";

const PAGE = "first-month";
// The stops drawn while the walkthrough loads.
const WAITING = ["1", "2", "3", "4", "5"];

interface HelpPathProps {
  // The walkthrough; undefined while the pages load.
  page: HelpLibraryPage | undefined;
}

// Families read: stepper (states of a process the user is in, with a current step and
// completion). The walkthrough as a path: its sections as numbered stops, each a link (help
// spec, HP1); this screen's form.
export function HelpPath({ page }: HelpPathProps) {
  const t = useT();
  const [locale] = useAppLocale();

  const stops = page?.document.sections ?? [];
  const count = numberFormatter(locale).format(
    page === undefined ? WAITING.length : stops.length,
  );

  return (
    <Section size="lg">
      <SectionHeader>
        <SectionTitle>
          <SectionHeading>
            {page?.document.title ?? <Skeleton inlineSize="24ch" />}
          </SectionHeading>
          <SectionDescription>
            {t("help.path.description", { count })}
          </SectionDescription>
        </SectionTitle>
        <SectionActions>
          <ButtonLink
            variant="outline"
            tone="secondary"
            end={
              <Icon size="sm">
                <StepGlyph direction="next" />
              </Icon>
            }
            render={(props) => (
              <Link {...props} to="/help/$page" params={{ page: PAGE }} />
            )}
          >
            {t("help.start")}
          </ButtonLink>
        </SectionActions>
      </SectionHeader>

      <SectionBody>
        <ol className={styles.pathSteps}>
          {page === undefined &&
            WAITING.map((number) => (
              <li className={styles.pathStep} key={number}>
                <span className={styles.pathLink}>
                  <span className={styles.pathNumber} aria-hidden="true">
                    {number}
                  </span>
                  <span className={styles.pathTitle}>
                    <Skeleton inlineSize="18ch" />
                  </span>
                </span>
              </li>
            ))}

          {stops.map((stop, index) => (
            <li className={styles.pathStep} key={stop.id}>
              <HelpAnchor
                className={styles.pathLink}
                page={PAGE}
                hash={stop.id}
              >
                <span className={styles.pathNumber} aria-hidden="true">
                  {index + 1}
                </span>
                <span className={styles.pathTitle}>
                  {stop.title.replace(/^\d+\.\s*/, "")}
                </span>
              </HelpAnchor>
            </li>
          ))}
        </ol>
      </SectionBody>
    </Section>
  );
}
