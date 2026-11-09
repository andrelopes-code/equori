import { useImportArchive } from "@/features/setup/api";
import type { DataMessage } from "@/features/setup/data-message";
import {
  asksForPassphrase,
  importDone,
  importError,
} from "@/features/setup/import-text";
import { useImportCredentials } from "@/features/setup/use-import-credentials";
import { useT } from "@/i18n/i18n-provider";

// Sends an archive with the credentials the owner gave, and the book name when it replaces the
// content (export design C5, R1), and reports the outcome through onMessage.
export function useArchiveImport(
  onMessage: (message: DataMessage | null) => void,
) {
  const t = useT();
  const importing = useImportArchive();
  const credentials = useImportCredentials();

  const send = (file: File, replaceBooksName?: string) => {
    onMessage(null);
    importing
      .mutateAsync({
        file,
        passphrase: credentials.passphrase,
        skipCredentials: credentials.skip,
        replaceBooksName,
      })
      .then((result) => {
        onMessage({ tone: "success", text: importDone(result, t) });
      })
      .catch((caught: unknown) => {
        credentials.setAsked(asksForPassphrase(caught));
        onMessage({ tone: "danger", text: importError(caught, t) });
      });
  };

  return { pending: importing.isPending, credentials, send };
}
