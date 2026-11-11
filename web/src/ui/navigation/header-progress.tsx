import { PageHeaderProgress } from "@slotted/react/page-header";

export function HeaderProgress({
  loading,
  delay,
}: {
  loading: boolean;
  delay?: number;
}) {
  return (
    <PageHeaderProgress
      loading={loading}
      {...(delay === undefined ? {} : { delay })}
    />
  );
}
