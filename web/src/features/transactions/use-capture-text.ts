import { useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { findQueued } from "@/features/transactions/capture-queue";
import {
  readCaptureDraft,
  readDefaultAccount,
  writeCaptureDraft,
  writeDefaultAccount,
  writeEntryForm,
} from "@/features/transactions/capture-store";

// The text, the changes made to its lines and the default account, kept in the session's draft.
export function useCaptureText() {
  // P5 of ADR 022: a text of the offline queue opens with the day it was written; it neither
  // reads nor writes the session's draft.
  const { queued: queuedId } = useSearch({
    from: "/_authed/transactions/capture",
  });
  const [entry] = useState(() =>
    queuedId === undefined ? undefined : findQueued(queuedId),
  );

  const [stored] = useState(() =>
    entry === undefined
      ? readCaptureDraft()
      : { text: entry.text, overrides: {} },
  );
  const [text, setText] = useState(stored.text);
  const [overrides, setOverrides] = useState(stored.overrides);
  const [defaultAccountId, setDefaultAccountId] = useState(
    () => entry?.defaultAccountId ?? readDefaultAccount(),
  );

  useEffect(() => {
    writeEntryForm("text");
  }, []);

  useEffect(() => {
    if (entry === undefined) writeCaptureDraft({ text, overrides });
  }, [entry, text, overrides]);

  function chooseDefaultAccount(id: string) {
    setDefaultAccountId(id);
    writeDefaultAccount(id);
  }

  return {
    entry,
    text,
    setText,
    overrides,
    setOverrides,
    defaultAccountId,
    chooseDefaultAccount,
  };
}
