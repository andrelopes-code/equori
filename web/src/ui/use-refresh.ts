import { useState } from "react";

// PageHeaderProgress waits 200 ms before it paints, so a refetch that answers sooner leaves a
// pressed Refresh with no sign of work (AF-03, AF-07). A refresh the reader asked for shows at
// once and is held for the header bar's minimum of 400 ms.
const minDuration = 400;

export function useRefresh(onRefresh: () => Promise<unknown>) {
  const [refreshing, setRefreshing] = useState(false);
  const refresh = () => {
    if (refreshing) return;
    setRefreshing(true);
    const held = new Promise((resolve) => setTimeout(resolve, minDuration));
    void Promise.allSettled([onRefresh(), held]).then(() => {
      setRefreshing(false);
    });
  };
  return { refreshing, refresh };
}
