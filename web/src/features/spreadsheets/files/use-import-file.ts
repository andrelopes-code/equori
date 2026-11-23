import { toast } from "@slotted/react/toast";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { errorText, ProblemError } from "@/api/problem";
import { useCreateSpreadsheet } from "@/features/spreadsheets/api";
import {
  contentFromFile,
  UnsupportedFileError,
} from "@/features/spreadsheets/files/content-from-file";
import { useT } from "@/i18n/i18n-provider";

// The longest name of a spreadsheet (spreadsheets design SS3).
const maxName = 120;

interface ImportFile {
  importing: boolean;
  importFile: (file: File) => void;
}

// Creates a spreadsheet from an XLSX or CSV file and opens it. A file of another kind, a file
// that does not read and a refusal of the server are each told in their own words.
export function useImportFile(): ImportFile {
  const t = useT();
  const navigate = useNavigate();
  const { mutateAsync } = useCreateSpreadsheet();
  const [importing, setImporting] = useState(false);

  function importFile(file: File) {
    setImporting(true);

    contentFromFile(file, t("spreadsheets.firstSheet"))
      .then(({ name, content }) =>
        mutateAsync({ name: name.slice(0, maxName), content }),
      )
      .then((created) =>
        navigate({ to: "/spreadsheets/$id", params: { id: created.id } }),
      )
      .catch((caught: unknown) => {
        const title =
          caught instanceof UnsupportedFileError
            ? t("spreadsheets.import.unsupported")
            : caught instanceof ProblemError
              ? errorText(caught, t)
              : t("spreadsheets.import.unreadable");

        toast.show({ tone: "danger", title });
      })
      .finally(() => {
        setImporting(false);
      });
  }

  return { importing, importFile };
}
