import { Page, PageBody } from "@slotted/react/page";
import { SkeletonText } from "@slotted/react/skeleton";
import { useSearch } from "@tanstack/react-router";

import { ScheduleForm } from "@/features/planning/schedule-form/schedule-form";
import { useFormStart } from "@/features/planning/schedule-form/use-form-start";

export function ScheduleFormPage() {
  const { from, ...preset } = useSearch({
    from: "/_authed/planning/schedules/new",
  });
  const start = useFormStart(from, preset);

  if (start === null)
    return (
      <Page width="wide">
        <PageBody>
          <SkeletonText lines={6} />
        </PageBody>
      </Page>
    );

  return <ScheduleForm initial={start} from={from} />;
}
