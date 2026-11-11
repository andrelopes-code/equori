import { useState } from "react";

// What the owner says about the credentials of the archive to import: the passphrase, whether the
// import asked for it, and the choice to import without them (export design C5).
export function useImportCredentials() {
  const [passphrase, setPassphrase] = useState("");
  const [asked, setAsked] = useState(false);
  const [skip, setSkip] = useState(false);

  return { passphrase, setPassphrase, asked, setAsked, skip, setSkip };
}

export type ImportCredentials = ReturnType<typeof useImportCredentials>;
