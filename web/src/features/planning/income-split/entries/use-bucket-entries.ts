import { useState } from "react";

export interface EntriesTarget {
  // A bucket id, or "outside" for the spending outside the split.
  bucket: string;
  month: string;
}

// The entries drawer of Track: which bucket and month it shows; undefined while it is closed.
export function useBucketEntries() {
  const [target, setTarget] = useState<EntriesTarget | undefined>();

  return {
    target,
    open: (bucket: string, month: string) => {
      setTarget({ bucket, month });
    },
    setMonth: (month: string) => {
      setTarget((current) =>
        current === undefined ? current : { ...current, month },
      );
    },
    close: () => {
      setTarget(undefined);
    },
  };
}
