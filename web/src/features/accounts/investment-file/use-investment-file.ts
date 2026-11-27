import type { UploadFile } from "@slotted/core/upload";
import { useState } from "react";

import { ProblemError, errorText, fieldErrors } from "@/api/problem";
import type { components } from "@/api/schema.gen";
import { useImportInvestmentFile } from "@/features/accounts/api";
import type { TFunction } from "@/i18n/i18n-provider";

type Result = components["schemas"]["InvestmentFileResult"];

// The state of the dialog: the file, the choices, the counted result and the problems of the file.
export function useInvestmentFile(brokerageId: string, t: TFunction) {
  const send = useImportInvestmentFile();
  const [files, setFiles] = useState<readonly UploadFile[]>([]);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [cashAccountId, setCashAccountId] = useState<string | null>(null);
  const [checked, setChecked] = useState<Result | null>(null);
  const [done, setDone] = useState<Result | null>(null);
  const [problems, setProblems] = useState<string[]>([]);
  const file = files.find((f) => f.status !== "rejected")?.file;

  function changeFiles(next: readonly UploadFile[]) {
    setFiles(next);
    setChecked(null);
    setProblems([]);
  }

  function run(dryRun: boolean) {
    if (file === undefined) return;
    setProblems([]);
    send
      .mutateAsync({ brokerageId, file, categoryId, cashAccountId, dryRun })
      .then(dryRun ? setChecked : setDone)
      .catch((caught: unknown) => {
        setChecked(null);
        setProblems(problemLines(caught, t));
      });
  }

  return {
    file,
    files,
    categoryId,
    cashAccountId,
    checked,
    done,
    problems,
    pending: send.isPending,
    changeFiles,
    changeCategory: setCategoryId,
    changeCash: setCashAccountId,
    check: () => {
      run(true);
    },
    submit: () => {
      run(false);
    },
  };
}

// The server names a rejected line `line N`; each problem reads `field: message`.
function problemLines(caught: unknown, t: TFunction): string[] {
  const lines =
    caught instanceof ProblemError
      ? Object.entries(fieldErrors(caught.problem)).map(
          ([field, message]) => `${field}: ${message}`,
        )
      : [];

  return lines.length > 0 ? lines : [errorText(caught, t)];
}
