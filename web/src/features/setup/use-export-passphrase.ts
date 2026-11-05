import { useState } from "react";

import { generatePassphrase } from "@/features/setup/generate-passphrase";
import { passphraseProblem } from "@/features/setup/passphrase-problem";
import type { PassphraseProblem } from "@/features/setup/passphrase-problem";

// The passphrase of an export with credentials: proposed by the dialog, replaceable by the owner
// (export design T9).
export function useExportPassphrase() {
  const [generated] = useState(generatePassphrase);
  const [passphrase, setPassphrase] = useState(generated);
  const [confirmation, setConfirmation] = useState("");
  const [saved, setSaved] = useState(false);
  const [problem, setProblem] = useState<PassphraseProblem | null>(null);
  const proposed = passphrase === generated;

  // Records the problem the owner sees and tells whether the export may go on.
  function check(): boolean {
    const found = passphraseProblem({
      passphrase,
      confirmation,
      proposed,
      saved,
    });
    setProblem(found);
    return found === null;
  }

  return {
    passphrase,
    confirmation,
    saved,
    problem,
    proposed,
    setPassphrase,
    setConfirmation,
    setSaved,
    check,
  };
}
