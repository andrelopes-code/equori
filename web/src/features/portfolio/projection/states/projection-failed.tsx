import {
  Section,
  SectionBody,
  SectionHeader,
  SectionHeading,
  SectionTitle,
} from "@slotted/react/section";

import { useT } from "@/i18n/i18n-provider";
import { QueryError } from "@/ui/feedback/query-error";

interface ProjectionFailedProps {
  error: Error;
  onRetry: () => void;
}

// PX11: a read that failed: one section that states it and asks the read again.
export function ProjectionFailed({ error, onRetry }: ProjectionFailedProps) {
  const t = useT();

  return (
    <Section
      size="lg"
      ground="surface"
      heading="title"
      aria-label={t("portfolio.projection.failed")}
    >
      <SectionHeader>
        <SectionTitle>
          <SectionHeading>{t("portfolio.projection.failed")}</SectionHeading>
        </SectionTitle>
      </SectionHeader>

      <SectionBody>
        <QueryError error={error} onRetry={onRetry} />
      </SectionBody>
    </Section>
  );
}
