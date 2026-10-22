import { PageHeaderProgress } from "@slotted/react/page-header";
import { useState } from "react";

// Workaround for Slotted finding "An edge progress bar shown again during its exit resumes its
// sweep mid-track": the bar keeps its element while it fades out, so a wait that starts before the
// fade ends continues the infinite sweep where it stood. Once the bar has begun to leave, the next
// wait draws a new element, whose sweep starts at the edge.
export function HeaderProgress({
  loading,
  delay,
}: {
  loading: boolean;
  delay?: number;
}) {
  const [shown, setShown] = useState({
    generation: 0,
    withdrawn: false,
    loading,
  });
  if (shown.loading !== loading) {
    setShown({
      generation:
        loading && shown.withdrawn ? shown.generation + 1 : shown.generation,
      withdrawn: loading ? false : shown.withdrawn,
      loading,
    });
  }
  return (
    <PageHeaderProgress
      key={shown.generation}
      loading={loading}
      {...(delay === undefined ? {} : { delay })}
      onWithdraw={() => {
        setShown((s) => ({ ...s, withdrawn: true }));
      }}
    />
  );
}
